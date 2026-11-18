import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REFERENCE_PHOTO } from '../storage/photo-limits';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../auth/types';
import { AssignArtistDto } from './dto/assign-artist.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionStatusDto } from './dto/update-status.dto';
import {
  allowedNextStatuses,
  canDeleteSubmission,
  canEditPhotos,
} from './submission-status';

const submissionInclude = {
  preferredArtist: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
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

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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
      },
      include: {
        ...submissionInclude,
        client: { select: clientSelect },
      },
    });
    return this.enrich(user, created);
  }

  async listMine(user: AuthUser) {
    if (user.role === Role.ADMIN) {
      const rows = await this.prisma.submission.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          ...submissionInclude,
          client: { select: clientSelect },
        },
      });
      return Promise.all(rows.map((r) => this.withSignedPhotoUrls(r)));
    }

    if (user.role === Role.ARTIST) {
      // Tylko zgłoszenia przypisane do tego artysty (bez puli „bez preferencji”)
      const rows = await this.prisma.submission.findMany({
        where: { preferredArtistId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          ...submissionInclude,
          client: { select: clientSelect },
        },
      });
      return Promise.all(rows.map((r) => this.withSignedPhotoUrls(r)));
    }

    const rows = await this.prisma.submission.findMany({
      where: { clientId: user.id },
      orderBy: { createdAt: 'desc' },
      include: submissionInclude,
    });
    return Promise.all(rows.map((r) => this.withSignedPhotoUrls(r)));
  }

  async getOne(user: AuthUser, id: string) {
    const submission = await this.findOrFail(id);
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
        `Nie można zmienić statusu z „${submission.status}” na „${dto.status}”`,
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
      dto.preferredArtistId === undefined || dto.preferredArtistId === null || dto.preferredArtistId === ''
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
    return this.enrich(user, updated);
  }

  async remove(user: AuthUser, id: string) {
    const submission = await this.findOrFail(id);
    this.assertCanView(user, submission.clientId, submission.preferredArtistId);

    if (user.role === Role.CLIENT && user.id !== submission.clientId) {
      throw new ForbiddenException('Brak dostępu do tego zgłoszenia');
    }
    if (!canDeleteSubmission(user.role, submission.status)) {
      throw new ForbiddenException('Tego zgłoszenia nie można usunąć w obecnym statusie');
    }
    if (user.role === Role.ARTIST) {
      throw new ForbiddenException('Artysta nie może usuwać zgłoszeń — użyj odrzucenia');
    }

    for (const photo of submission.photos) {
      try {
        await this.storage.deleteObject(photo.objectKey);
      } catch {
        // kontynuuj usuwanie rekordu
      }
    }

    await this.prisma.submission.delete({ where: { id } });
    return { message: 'Zgłoszenie usunięte' };
  }

  async addPhoto(
    user: AuthUser,
    submissionId: string,
    file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Nie przesłano pliku');
    }

    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
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
    if (!photo) {
      throw new NotFoundException('Nie znaleziono zdjęcia');
    }
    this.assertCanEditPhotos(user, photo.submission.clientId, photo.submission.status);

    try {
      await this.storage.deleteObject(photo.objectKey);
    } catch {
      // rekord i tak usuwamy – plik mógł już nie istnieć
    }
    await this.prisma.referencePhoto.delete({ where: { id: photo.id } });
    return { message: 'Zdjęcie usunięte' };
  }

  private async findOrFail(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
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

  private enrich<T extends { status: SubmissionStatus; photos: Array<{
    id: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }> }>(user: AuthUser, submission: T) {
    return this.withSignedPhotoUrls(submission).then((row) => ({
      ...row,
      allowedStatuses: allowedNextStatuses(user.role, submission.status),
      canDelete: canDeleteSubmission(user.role, submission.status),
      canEditPhotos: canEditPhotos(submission.status) && (user.role === Role.CLIENT || user.role === Role.ADMIN),
      canAssignArtist: user.role === Role.ADMIN,
    }));
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
