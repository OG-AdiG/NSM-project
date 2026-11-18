import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, SessionStatus, SubmissionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types';
import { CreateSessionDto } from './dto/create-session.dto';

const sessionInclude = {
  artist: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      artistProfile: { select: { displayName: true } },
    },
  },
  client: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  submission: {
    select: {
      id: true,
      status: true,
      sessionCount: true,
      style: true,
      bodyPart: true,
    },
  },
} as const;

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateSessionDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(endsAt > startsAt)) {
      throw new BadRequestException('Koniec sesji musi być po początku');
    }
    if (startsAt.getTime() < Date.now() + 30 * 60 * 1000) {
      throw new BadRequestException('Termin musi być co najmniej 30 minut w przyszłości');
    }

    const artist = await this.prisma.user.findFirst({
      where: { id: dto.artistId, role: Role.ARTIST, artistProfile: { active: true } },
    });
    if (!artist) {
      throw new BadRequestException('Wybrany artysta jest niedostępny');
    }

    let clientId = user.id;
    let sessionIndex = 1;
    let submissionId: string | null = dto.submissionId ?? null;

    if (user.role === Role.CLIENT) {
      if (!dto.submissionId) {
        throw new BadRequestException('Klient rezerwuje termin w ramach zaakceptowanego zgłoszenia');
      }
      const submission = await this.prisma.submission.findFirst({
        where: { id: dto.submissionId, deletedAt: null },
      });
      if (!submission || submission.clientId !== user.id) {
        throw new ForbiddenException('Brak dostępu do zgłoszenia');
      }
      if (submission.status !== SubmissionStatus.ACCEPTED) {
        throw new BadRequestException('Rezerwacja możliwa dopiero po akceptacji wyceny');
      }
      if (submission.preferredArtistId && submission.preferredArtistId !== dto.artistId) {
        throw new BadRequestException('Termin musi być u przypisanego artysty');
      }
      sessionIndex = await this.nextSessionIndex(submission.id, submission.sessionCount);
    } else if (user.role === Role.ARTIST) {
      if (user.id !== dto.artistId) {
        throw new ForbiddenException('Możesz tworzyć sesje tylko w swoim grafiku');
      }
      if (!dto.submissionId) {
        throw new BadRequestException('Podaj zgłoszenie klienta');
      }
      const submission = await this.prisma.submission.findFirst({
        where: { id: dto.submissionId, deletedAt: null },
      });
      if (!submission) throw new NotFoundException('Nie znaleziono zgłoszenia');
      if (submission.preferredArtistId && submission.preferredArtistId !== user.id) {
        throw new ForbiddenException('Zgłoszenie nie jest do Ciebie przypisane');
      }
      clientId = submission.clientId;
      sessionIndex = await this.nextSessionIndex(submission.id, submission.sessionCount);
    } else if (user.role === Role.ADMIN) {
      if (!dto.submissionId) {
        throw new BadRequestException('Podaj zgłoszenie');
      }
      const submission = await this.prisma.submission.findFirst({
        where: { id: dto.submissionId, deletedAt: null },
      });
      if (!submission) throw new NotFoundException('Nie znaleziono zgłoszenia');
      clientId = submission.clientId;
      sessionIndex = await this.nextSessionIndex(submission.id, submission.sessionCount);
    } else {
      throw new ForbiddenException('Brak uprawnień');
    }

    try {
      return await this.prisma.tattooSession.create({
        data: {
          artistId: dto.artistId,
          clientId,
          submissionId,
          startsAt,
          endsAt,
          type: dto.type,
          status: SessionStatus.AWAITING_DEPOSIT,
          sessionIndex,
          notes: dto.notes?.trim() || null,
        },
        include: sessionInclude,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Termin koliduje z inną rezerwacją');
      }
      // exclusion constraint często jako P2034 lub raw 23P01
      const msg = String(err);
      if (msg.includes('TattooSession_no_overlap') || msg.includes('23P01')) {
        throw new ConflictException('Termin jest już zajęty (kolizja w grafiku artysty)');
      }
      throw err;
    }
  }

  async list(user: AuthUser, submissionId?: string) {
    const where: Prisma.TattooSessionWhereInput = {};
    if (submissionId) where.submissionId = submissionId;

    if (user.role === Role.CLIENT) {
      where.clientId = user.id;
    } else if (user.role === Role.ARTIST) {
      where.artistId = user.id;
    }

    return this.prisma.tattooSession.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      include: sessionInclude,
    });
  }

  async getOne(user: AuthUser, id: string) {
    const row = await this.prisma.tattooSession.findUnique({
      where: { id },
      include: sessionInclude,
    });
    if (!row) throw new NotFoundException('Nie znaleziono sesji');
    this.assertCanView(user, row.clientId, row.artistId);
    return row;
  }

  async cancel(user: AuthUser, id: string) {
    const row = await this.prisma.tattooSession.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Nie znaleziono sesji');
    this.assertCanView(user, row.clientId, row.artistId);

    if (
      row.status === SessionStatus.CANCELLED ||
      row.status === SessionStatus.COMPLETED ||
      row.status === SessionStatus.NO_SHOW
    ) {
      throw new BadRequestException('Tej sesji nie można anulować');
    }

    return this.prisma.tattooSession.update({
      where: { id },
      data: { status: SessionStatus.CANCELLED },
      include: sessionInclude,
    });
  }

  /** Tymczasowo bez Stripe (FR-19) — artysta/admin potwierdza ręcznie */
  async confirm(user: AuthUser, id: string) {
    if (user.role !== Role.ARTIST && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Tylko artysta lub admin może potwierdzić sesję');
    }
    const row = await this.prisma.tattooSession.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Nie znaleziono sesji');
    if (user.role === Role.ARTIST && row.artistId !== user.id) {
      throw new ForbiddenException('Brak dostępu');
    }
    if (row.status !== SessionStatus.AWAITING_DEPOSIT) {
      throw new BadRequestException('Sesja nie oczekuje na potwierdzenie');
    }
    return this.prisma.tattooSession.update({
      where: { id },
      data: { status: SessionStatus.CONFIRMED },
      include: sessionInclude,
    });
  }

  async complete(user: AuthUser, id: string) {
    if (user.role !== Role.ARTIST && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Brak uprawnień');
    }
    const row = await this.prisma.tattooSession.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Nie znaleziono sesji');
    if (user.role === Role.ARTIST && row.artistId !== user.id) {
      throw new ForbiddenException('Brak dostępu');
    }
    if (row.status !== SessionStatus.CONFIRMED) {
      throw new BadRequestException('Można zakończyć tylko potwierdzoną sesję');
    }
    return this.prisma.tattooSession.update({
      where: { id },
      data: { status: SessionStatus.COMPLETED },
      include: sessionInclude,
    });
  }

  /** Postęp projektu wielosesyjnego (FR-16) */
  async projectProgress(user: AuthUser, submissionId: string) {
    const submission = await this.prisma.submission.findFirst({
      where: { id: submissionId, deletedAt: null },
      include: {
        sessions: {
          orderBy: { sessionIndex: 'asc' },
          include: sessionInclude,
        },
      },
    });
    if (!submission) throw new NotFoundException('Nie znaleziono zgłoszenia');

    if (user.role === Role.CLIENT && submission.clientId !== user.id) {
      throw new ForbiddenException('Brak dostępu');
    }
    if (
      user.role === Role.ARTIST &&
      submission.preferredArtistId &&
      submission.preferredArtistId !== user.id
    ) {
      throw new ForbiddenException('Brak dostępu');
    }

    const planned = submission.sessionCount ?? 1;
    const active = submission.sessions.filter((s) => s.status !== SessionStatus.CANCELLED);
    const completed = active.filter((s) => s.status === SessionStatus.COMPLETED).length;

    return {
      submissionId,
      plannedSessions: planned,
      bookedSessions: active.length,
      completedSessions: completed,
      remainingSessions: Math.max(0, planned - active.length),
      canBookMore: active.length < planned && submission.status === SubmissionStatus.ACCEPTED,
      sessions: submission.sessions,
    };
  }

  private async nextSessionIndex(submissionId: string, sessionCount: number | null) {
    const planned = sessionCount && sessionCount > 0 ? sessionCount : 1;
    const existing = await this.prisma.tattooSession.count({
      where: {
        submissionId,
        status: { not: SessionStatus.CANCELLED },
      },
    });
    if (existing >= planned) {
      throw new BadRequestException(
        `Wszystkie zaplanowane sesje (${planned}) są już zarezerwowane`,
      );
    }
    return existing + 1;
  }

  private assertCanView(user: AuthUser, clientId: string, artistId: string) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.CLIENT && user.id === clientId) return;
    if (user.role === Role.ARTIST && user.id === artistId) return;
    throw new ForbiddenException('Brak dostępu do sesji');
  }
}
