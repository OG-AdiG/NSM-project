import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, SessionStatus, SessionType, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { REFERENCE_PHOTO } from '../storage/photo-limits';
import { StorageService } from '../storage/storage.service';
import { estimateTattooPrice } from '../pricing/estimate';
import { AuthUser } from '../auth/types';
import { AssignArtistDto } from './dto/assign-artist.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { RejectSubmissionDto } from './dto/reject-submission.dto';
import { UpdateSubmissionStatusDto } from './dto/update-status.dto';
import {
  allowedNextStatuses,
  canArchive,
  canDeleteOrArchive,
  canEditPhotos,
  canHardDelete,
} from './submission-status';

const submissionInclude = {
  preferredArtist: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      artistProfile: { select: { displayName: true, styles: true } },
    },
  },
  photos: {
    select: {
      id: true,
      objectKey: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  },
} as const;

const clientSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
} as const;

export type ListFilters = {
  unassigned?: boolean;
  archived?: boolean;
};

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);
  private readonly webUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3000');
  }

  async create(user: AuthUser, dto: CreateSubmissionDto) {
    if (user.role !== Role.CLIENT && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Tylko klient może składać zgłoszenia');
    }
    if (user.role === Role.CLIENT) {
      const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!full.emailVerifiedAt) {
        throw new ForbiddenException('Potwierdź adres e-mail przed wysłaniem zgłoszenia');
      }
    }

    if (dto.preferredArtistId) {
      await this.assertActiveArtist(dto.preferredArtistId);
    }

    const estimate = estimateTattooPrice({
      size: dto.size,
      style: dto.style,
      colorMode: dto.colorMode,
      bodyPart: dto.bodyPart,
    });

    if (dto.preferredSlotStart && dto.preferredSlotEnd) {
      const a = new Date(dto.preferredSlotStart);
      const b = new Date(dto.preferredSlotEnd);
      if (!(b > a)) {
        throw new BadRequestException('Preferowana godzina końca musi być po początku');
      }
    }

    const preferredDate = dto.preferredDate
      ? new Date(dto.preferredDate.includes('T') ? dto.preferredDate : `${dto.preferredDate}T12:00:00`)
      : dto.preferredSlotStart
        ? new Date(dto.preferredSlotStart)
        : null;

    const created = await this.prisma.submission.create({
      data: {
        clientId: user.id,
        preferredArtistId: dto.preferredArtistId || null,
        description: dto.description.trim(),
        bodyPart: dto.bodyPart.trim(),
        size: dto.size.trim(),
        style: dto.style.trim(),
        colorMode: dto.colorMode,
        status: SubmissionStatus.NEW,
        estimateMinPln: estimate.minPln,
        estimateMaxPln: estimate.maxPln,
        sessionCount: estimate.suggestedSessions,
        preferredDate,
        preferredSlotStart: dto.preferredSlotStart ? new Date(dto.preferredSlotStart) : null,
        preferredSlotEnd: dto.preferredSlotEnd ? new Date(dto.preferredSlotEnd) : null,
        preferredTimeNote: dto.preferredTimeNote?.trim() || null,
      },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });

    void this.notifyAfterCreate(created).catch((err) =>
      this.logger.warn(`Powiadomienie po create: ${String(err)}`),
    );

    return this.enrich(user, created);
  }

  async listMine(user: AuthUser, filters: ListFilters = {}) {
    const where: Prisma.SubmissionWhereInput = {};

    if (filters.archived) {
      if (user.role !== Role.ADMIN) {
        throw new ForbiddenException('Archiwum dostępne tylko dla administratora');
      }
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }

    if (user.role === Role.ADMIN) {
      if (filters.unassigned) {
        where.preferredArtistId = null;
      }
    } else if (user.role === Role.ARTIST) {
      where.preferredArtistId = user.id;
    } else {
      where.clientId = user.id;
    }

    const rows = await this.prisma.submission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });
    return Promise.all(rows.map((r) => this.enrich(user, r)));
  }

  async getOne(user: AuthUser, id: string) {
    const submission = await this.findOrFail(id, user.role === Role.ADMIN);
    this.assertCanView(user, submission.clientId, submission.preferredArtistId);
    return this.enrich(user, submission);
  }

  async updateStatus(user: AuthUser, id: string, dto: UpdateSubmissionStatusDto) {
    const submission = await this.findOrFail(id);
    this.assertCanView(user, submission.clientId, submission.preferredArtistId);

    if (user.role === Role.ARTIST && submission.preferredArtistId !== user.id) {
      throw new ForbiddenException('Możesz zmieniać status tylko swoich zgłoszeń');
    }

    const allowed = allowedNextStatuses(user.role, submission.status);
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Nie można zmienić statusu z „${submission.status}” na „${dto.status}”. Wycena i odrzucenie mają osobne akcje.`,
      );
    }

    const updated = await this.prisma.submission.update({
      where: { id },
      data: { status: dto.status },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });

    if (dto.status === SubmissionStatus.ACCEPTED) {
      await this.tryBookPreferredSlotAfterAccept(user, updated);
    }

    return this.enrich(user, updated);
  }

  /** Po akceptacji wyceny — utwórz sesję z preferowanego slotu (jeśli nadal wolny). */
  private async tryBookPreferredSlotAfterAccept(
    actor: AuthUser,
    submission: {
      id: string;
      clientId: string;
      preferredArtistId: string | null;
      preferredSlotStart: Date | null;
      preferredSlotEnd: Date | null;
      sessionCount: number | null;
    },
  ) {
    const artistId = submission.preferredArtistId;
    const startsAt = submission.preferredSlotStart;
    const endsAt = submission.preferredSlotEnd;

    if (!artistId || !startsAt || !endsAt) {
      await this.prisma.submissionMessage.create({
        data: {
          submissionId: submission.id,
          authorId: actor.id,
          body:
            'Wycena zaakceptowana. Umów termin sesji w sekcji rezerwacji na stronie zgłoszenia.',
          system: true,
        },
      });
      return;
    }

    if (!(endsAt > startsAt) || startsAt.getTime() < Date.now() + 30 * 60 * 1000) {
      await this.prisma.submissionMessage.create({
        data: {
          submissionId: submission.id,
          authorId: actor.id,
          body:
            'Wycena zaakceptowana, ale preferowany termin jest już niedostępny. Wybierz nowy termin w sekcji rezerwacji.',
          system: true,
        },
      });
      return;
    }

    const existing = await this.prisma.tattooSession.count({
      where: {
        submissionId: submission.id,
        status: { not: SessionStatus.CANCELLED },
      },
    });
    if (existing > 0) return;

    try {
      await this.prisma.tattooSession.create({
        data: {
          artistId,
          clientId: submission.clientId,
          submissionId: submission.id,
          startsAt,
          endsAt,
          type: SessionType.SESSION,
          status: SessionStatus.AWAITING_DEPOSIT,
          sessionIndex: 1,
        },
      });
      await this.prisma.submissionMessage.create({
        data: {
          submissionId: submission.id,
          authorId: actor.id,
          body: `Wycena zaakceptowana. Zarezerwowano preferowany termin: ${startsAt.toLocaleString('pl-PL')} – ${endsAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}. Szczegóły w Rezerwacjach.`,
          system: true,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Nie udało się zarezerwować preferowanego slotu dla ${submission.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      await this.prisma.submissionMessage.create({
        data: {
          submissionId: submission.id,
          authorId: actor.id,
          body:
            'Wycena zaakceptowana, ale preferowany termin jest zajęty. Wybierz inny termin w sekcji rezerwacji.',
          system: true,
        },
      });
    }
  }

  async createQuote(user: AuthUser, id: string, dto: CreateQuoteDto) {
    const submission = await this.findOrFail(id);
    this.assertCanView(user, submission.clientId, submission.preferredArtistId);

    if (user.role === Role.CLIENT) {
      throw new ForbiddenException('Klient nie wystawia wyceny');
    }
    if (user.role === Role.ARTIST && submission.preferredArtistId !== user.id) {
      throw new ForbiddenException('Możesz wyceniać tylko swoje zgłoszenia');
    }
    if (
      submission.status !== SubmissionStatus.NEW &&
      submission.status !== SubmissionStatus.QUOTED
    ) {
      throw new BadRequestException('Wycenę można wystawić tylko dla zgłoszenia nowego lub już wycenionego');
    }
    if (dto.estimateMinPln != null && dto.estimateMaxPln != null && dto.estimateMinPln > dto.estimateMaxPln) {
      throw new BadRequestException('Widełki: minimum nie może być większe niż maksimum');
    }

    const updated = await this.prisma.submission.update({
      where: { id },
      data: {
        status: SubmissionStatus.QUOTED,
        finalPricePln: dto.finalPricePln,
        sessionCount: dto.sessionCount ?? submission.sessionCount,
        estimateMinPln: dto.estimateMinPln ?? submission.estimateMinPln,
        estimateMaxPln: dto.estimateMaxPln ?? submission.estimateMaxPln,
        quoteNote: dto.quoteNote?.trim() || null,
      },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });

    const link = `${this.webUrl}/zgloszenia/${id}`;
    try {
      await this.mail.sendQuoteEmail(
        updated.client.email,
        link,
        updated.finalPricePln!,
        updated.quoteNote,
      );
    } catch {
      this.logger.warn('Nie wysłano maila z wyceną');
    }

    return this.enrich(user, updated);
  }

  async reject(user: AuthUser, id: string, dto: RejectSubmissionDto) {
    const submission = await this.findOrFail(id);
    this.assertCanView(user, submission.clientId, submission.preferredArtistId);

    if (user.role === Role.CLIENT) {
      throw new ForbiddenException('Klient nie odrzuca zgłoszeń — użyj anulowania');
    }
    if (user.role === Role.ARTIST && submission.preferredArtistId !== user.id) {
      throw new ForbiddenException('Możesz odrzucać tylko swoje zgłoszenia');
    }
    if (
      submission.status !== SubmissionStatus.NEW &&
      submission.status !== SubmissionStatus.QUOTED
    ) {
      throw new BadRequestException('Można odrzucić tylko zgłoszenie nowe lub wycenione');
    }

    const reason = dto.reason.trim();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.submissionMessage.create({
        data: {
          submissionId: id,
          authorId: user.id,
          body: `Odrzucenie: ${reason}`,
          system: true,
        },
      });
      return tx.submission.update({
        where: { id },
        data: {
          status: SubmissionStatus.REJECTED,
          rejectionReason: reason,
        },
        include: {
          ...submissionInclude,
          client: { select: clientSelect },
        },
      });
    });

    const link = `${this.webUrl}/zgloszenia/${id}`;
    try {
      await this.mail.sendRejectionEmail(updated.client.email, link, reason);
    } catch {
      this.logger.warn('Nie wysłano maila o odrzuceniu');
    }

    return this.enrich(user, updated);
  }

  async assignArtist(user: AuthUser, id: string, dto: AssignArtistDto) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Tylko administrator może przypisywać artystę');
    }

    const submission = await this.findOrFail(id);
    if (
      submission.status !== SubmissionStatus.NEW &&
      submission.status !== SubmissionStatus.QUOTED
    ) {
      throw new BadRequestException('Artystę można zmienić tylko dla zgłoszenia nowego lub wycenionego');
    }

    const preferredArtistId =
      dto.preferredArtistId === undefined ||
      dto.preferredArtistId === null ||
      dto.preferredArtistId === ''
        ? null
        : dto.preferredArtistId;

    if (preferredArtistId) {
      await this.assertActiveArtist(preferredArtistId);
    }

    const updated = await this.prisma.submission.update({
      where: { id },
      data: { preferredArtistId },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });

    if (preferredArtistId && updated.preferredArtist?.email) {
      const link = `${this.webUrl}/zgloszenia/${id}`;
      const summary = `${updated.style} · ${updated.bodyPart}`;
      try {
        await this.mail.sendAssignedSubmissionEmail(
          updated.preferredArtist.email,
          link,
          summary,
        );
      } catch {
        this.logger.warn('Nie wysłano maila o przypisaniu');
      }
    }

    return this.enrich(user, updated);
  }

  async remove(user: AuthUser, id: string, mode?: 'hard' | 'archive') {
    const submission = await this.findOrFail(id);
    this.assertCanView(user, submission.clientId, submission.preferredArtistId);

    if (user.role === Role.CLIENT && user.id !== submission.clientId) {
      throw new ForbiddenException('Brak dostępu do tego zgłoszenia');
    }
    if (!canDeleteOrArchive(user.role, submission.status)) {
      throw new ForbiddenException('Tego zgłoszenia nie można usunąć / zarchiwizować w obecnym statusie');
    }

    const allowHard = canHardDelete(user.role, submission.status);
    const allowArchive = canArchive(user.role, submission.status);

    // Jawny wybór z UI; bez mode: preferuj archiwum gdy dostępne
    const resolved: 'hard' | 'archive' =
      mode === 'hard' || mode === 'archive'
        ? mode
        : allowArchive
          ? 'archive'
          : 'hard';

    if (resolved === 'archive') {
      if (!allowArchive) {
        throw new ForbiddenException('Tego zgłoszenia nie można przenieść do archiwum');
      }
      await this.prisma.submission.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { message: 'Zgłoszenie przeniesione do archiwum', mode: 'archive' as const };
    }

    if (!allowHard) {
      throw new ForbiddenException('Tego zgłoszenia nie można trwale usunąć');
    }
    for (const photo of submission.photos) {
      try {
        await this.storage.deleteObject(photo.objectKey);
      } catch {
        // ignore
      }
    }
    await this.prisma.submission.delete({ where: { id } });
    return { message: 'Zgłoszenie trwale usunięte', mode: 'hard' as const };
  }

  async restore(user: AuthUser, id: string) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Tylko administrator może przywracać z archiwum');
    }
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });
    if (!submission || !submission.deletedAt) {
      throw new NotFoundException('Nie znaleziono zgłoszenia w archiwum');
    }
    const updated = await this.prisma.submission.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });
    return this.enrich(user, updated);
  }

  async listMessages(user: AuthUser, id: string) {
    const submission = await this.findOrFail(id, user.role === Role.ADMIN);
    this.assertCanView(user, submission.clientId, submission.preferredArtistId);

    return this.prisma.submissionMessage.findMany({
      where: { submissionId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true, email: true },
        },
      },
    });
  }

  async addMessage(user: AuthUser, id: string, dto: CreateMessageDto) {
    const submission = await this.findOrFail(id);
    this.assertCanView(user, submission.clientId, submission.preferredArtistId);

    if (
      submission.status === SubmissionStatus.COMPLETED ||
      submission.status === SubmissionStatus.CANCELLED
    ) {
      throw new BadRequestException('Nie można pisać w zamkniętym zgłoszeniu');
    }

    const message = await this.prisma.submissionMessage.create({
      data: {
        submissionId: id,
        authorId: user.id,
        body: dto.body.trim(),
        system: false,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, role: true, email: true },
        },
      },
    });

    const link = `${this.webUrl}/zgloszenia/${id}`;
    const recipients = new Set<string>();
    if (submission.client.email && submission.clientId !== user.id) {
      recipients.add(submission.client.email);
    }
    if (
      submission.preferredArtist?.email &&
      submission.preferredArtistId &&
      submission.preferredArtistId !== user.id
    ) {
      recipients.add(submission.preferredArtist.email);
    }
    if (user.role !== Role.ADMIN) {
      const admins = await this.prisma.user.findMany({
        where: { role: Role.ADMIN },
        select: { email: true },
      });
      // nie spamuj adminów przy każdej wiadomości — tylko gdy brak artysty
      if (!submission.preferredArtistId) {
        for (const a of admins) recipients.add(a.email);
      }
    }

    const preview = message.body.slice(0, 200);
    for (const to of recipients) {
      try {
        await this.mail.sendSubmissionMessageEmail(to, link, preview);
      } catch {
        this.logger.warn(`Nie wysłano maila wiadomości do ${to}`);
      }
    }

    return message;
  }

  async addPhoto(
    user: AuthUser,
    submissionId: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Nie przesłano pliku');
    }

    const submission = await this.prisma.submission.findFirst({
      where: { id: submissionId, deletedAt: null },
      include: { photos: true },
    });
    if (!submission) {
      throw new NotFoundException('Nie znaleziono zgłoszenia');
    }
    this.assertCanEditPhotos(user, submission.clientId, submission.status);

    if (submission.photos.length >= REFERENCE_PHOTO.maxFiles) {
      throw new BadRequestException(
        `Można dodać maksymalnie ${REFERENCE_PHOTO.maxFiles} zdjęć referencyjnych`,
      );
    }

    const allowed = REFERENCE_PHOTO.allowedMimeTypes as readonly string[];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Dozwolone typy plików: JPEG, PNG, WebP');
    }
    if (file.size > REFERENCE_PHOTO.maxBytes) {
      throw new BadRequestException(
        `Plik jest za duży (max ${Math.round(REFERENCE_PHOTO.maxBytes / (1024 * 1024))} MB)`,
      );
    }

    const objectKey = this.storage.buildObjectKey(submissionId, file.originalname);
    try {
      await this.storage.uploadObject(objectKey, file.buffer, file.mimetype);
    } catch {
      throw new ServiceUnavailableException(
        'Nie udało się zapisać pliku w magazynie (MinIO). Sprawdź, czy usługa działa.',
      );
    }

    const photo = await this.prisma.referencePhoto.create({
      data: {
        submissionId,
        objectKey,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    const url = await this.storage.getSignedGetUrl(objectKey);
    return { ...photo, url };
  }

  async removePhoto(user: AuthUser, submissionId: string, photoId: string) {
    const photo = await this.prisma.referencePhoto.findFirst({
      where: { id: photoId, submissionId },
      include: { submission: true },
    });
    if (!photo || photo.submission.deletedAt) {
      throw new NotFoundException('Nie znaleziono zdjęcia');
    }
    this.assertCanEditPhotos(user, photo.submission.clientId, photo.submission.status);

    try {
      await this.storage.deleteObject(photo.objectKey);
    } catch {
      // ignore
    }
    await this.prisma.referencePhoto.delete({ where: { id: photo.id } });
    return { message: 'Zdjęcie usunięte' };
  }

  private async notifyAfterCreate(
    created: {
      id: string;
      style: string;
      bodyPart: string;
      preferredArtistId: string | null;
      preferredArtist: { email: string } | null;
    },
  ) {
    const link = `${this.webUrl}/zgloszenia/${created.id}`;
    const summary = `${created.style} · ${created.bodyPart}`;

    if (!created.preferredArtistId) {
      const admins = await this.prisma.user.findMany({
        where: { role: Role.ADMIN },
        select: { email: true },
      });
      for (const admin of admins) {
        await this.mail.sendUnassignedSubmissionEmail(admin.email, link, summary);
      }
      return;
    }

    if (created.preferredArtist?.email) {
      await this.mail.sendAssignedSubmissionEmail(
        created.preferredArtist.email,
        link,
        summary,
      );
    }
  }

  private async findOrFail(id: string, includeArchived = false) {
    const submission = await this.prisma.submission.findFirst({
      where: includeArchived ? { id } : { id, deletedAt: null },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });
    if (!submission) {
      throw new NotFoundException('Nie znaleziono zgłoszenia');
    }
    return submission;
  }

  private async assertActiveArtist(artistUserId: string) {
    const artist = await this.prisma.user.findFirst({
      where: {
        id: artistUserId,
        role: Role.ARTIST,
        artistProfile: { active: true },
      },
    });
    if (!artist) {
      throw new BadRequestException('Wybrany artysta nie istnieje lub jest nieaktywny');
    }
  }

  private assertCanView(user: AuthUser, clientId: string, artistId: string | null) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.CLIENT && user.id === clientId) return;
    if (user.role === Role.ARTIST && artistId === user.id) return;
    throw new ForbiddenException('Brak dostępu do tego zgłoszenia');
  }

  private assertCanEditPhotos(user: AuthUser, clientId: string, status: SubmissionStatus) {
    if (!canEditPhotos(status)) {
      throw new ForbiddenException('Zdjęcia można edytować tylko w statusie „Nowe”');
    }
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.CLIENT && user.id === clientId) return;
    throw new ForbiddenException('Tylko właściciel zgłoszenia może zarządzać zdjęciami');
  }

  private async enrich<
    T extends {
      status: SubmissionStatus;
      preferredArtistId: string | null;
      deletedAt: Date | null;
      photos: Array<{
        id: string;
        objectKey: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        createdAt: Date;
      }>;
    },
  >(user: AuthUser, submission: T) {
    const withPhotos = await this.withSignedPhotoUrls(submission);
    const canQuote =
      (user.role === Role.ARTIST || user.role === Role.ADMIN) &&
      (submission.status === SubmissionStatus.NEW ||
        submission.status === SubmissionStatus.QUOTED) &&
      (user.role === Role.ADMIN || submission.preferredArtistId === user.id);
    const canReject =
      (user.role === Role.ARTIST || user.role === Role.ADMIN) &&
      (submission.status === SubmissionStatus.NEW ||
        submission.status === SubmissionStatus.QUOTED) &&
      (user.role === Role.ADMIN || submission.preferredArtistId === user.id);

    return {
      ...withPhotos,
      allowedStatuses: allowedNextStatuses(user.role, submission.status),
      canDelete: canDeleteOrArchive(user.role, submission.status) && !submission.deletedAt,
      canHardDelete: canHardDelete(user.role, submission.status),
      canArchive: canArchive(user.role, submission.status),
      canEditPhotos:
        canEditPhotos(submission.status) &&
        (user.role === Role.CLIENT || user.role === Role.ADMIN),
      canAssignArtist: user.role === Role.ADMIN && !submission.deletedAt,
      canQuote,
      canReject,
      canMessage: !submission.deletedAt && submission.status !== SubmissionStatus.COMPLETED,
      isArchived: Boolean(submission.deletedAt),
    };
  }

  private async withSignedPhotoUrls<
    T extends {
      photos: Array<{
        id: string;
        objectKey: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        createdAt: Date;
      }>;
    },
  >(submission: T) {
    const photos = await Promise.all(
      submission.photos.map(async (p) => {
        let url: string | null = null;
        try {
          url = await this.storage.getSignedGetUrl(p.objectKey);
        } catch {
          url = null;
        }
        const { objectKey: _objectKey, ...rest } = p;
        return { ...rest, url };
      }),
    );
    return { ...submission, photos };
  }
}
