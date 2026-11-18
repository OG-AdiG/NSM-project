import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, SessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { SetWeeklyAvailabilityDto } from './dto/set-weekly.dto';
import {
  Interval,
  isoWeekday,
  minutesToDate,
  sliceSlots,
  subtractIntervals,
} from './slots.util';

const ACTIVE_SESSION: SessionStatus[] = [
  SessionStatus.AWAITING_DEPOSIT,
  SessionStatus.CONFIRMED,
];

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getWeekly(artistId: string) {
    await this.assertArtistExists(artistId);
    return this.prisma.weeklyAvailability.findMany({
      where: { artistId },
      orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }],
    });
  }

  async setWeekly(user: AuthUser, artistId: string, dto: SetWeeklyAvailabilityDto) {
    this.assertCanManage(user, artistId);
    await this.assertArtistExists(artistId);

    for (const s of dto.slots) {
      if (s.endMin <= s.startMin) {
        throw new BadRequestException('Godzina końca musi być po godzinie początku');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.weeklyAvailability.deleteMany({ where: { artistId } });
      if (dto.slots.length) {
        await tx.weeklyAvailability.createMany({
          data: dto.slots.map((s) => ({
            artistId,
            weekday: s.weekday,
            startMin: s.startMin,
            endMin: s.endMin,
          })),
        });
      }
    });

    return this.getWeekly(artistId);
  }

  async listAbsences(artistId: string, from?: string, to?: string) {
    await this.assertArtistExists(artistId);
    return this.prisma.artistAbsence.findMany({
      where: {
        artistId,
        ...(from || to
          ? {
              startsAt: to ? { lte: new Date(to) } : undefined,
              endsAt: from ? { gte: new Date(from) } : undefined,
            }
          : {}),
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async createAbsence(user: AuthUser, artistId: string, dto: CreateAbsenceDto) {
    this.assertCanManage(user, artistId);
    await this.assertArtistExists(artistId);
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(endsAt > startsAt)) {
      throw new BadRequestException('Koniec nieobecności musi być po początku');
    }
    return this.prisma.artistAbsence.create({
      data: {
        artistId,
        startsAt,
        endsAt,
        reason: dto.reason?.trim() || null,
      },
    });
  }

  async deleteAbsence(user: AuthUser, artistId: string, absenceId: string) {
    this.assertCanManage(user, artistId);
    const row = await this.prisma.artistAbsence.findFirst({
      where: { id: absenceId, artistId },
    });
    if (!row) throw new NotFoundException('Nie znaleziono nieobecności');
    await this.prisma.artistAbsence.delete({ where: { id: absenceId } });
    return { message: 'Nieobecność usunięta' };
  }

  /**
   * FR-14: wolne terminy = grafik tygodniowy − nieobecności − aktywne sesje
   */
  async getFreeSlots(
    artistId: string,
    fromIso: string,
    toIso: string,
    durationMinutes: number,
  ) {
    await this.assertArtistExists(artistId);
    if (durationMinutes < 15 || durationMinutes > 12 * 60) {
      throw new BadRequestException('Czas trwania slotu: 15–720 minut');
    }

    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (!(to > from)) {
      throw new BadRequestException('Zakres dat jest nieprawidłowy');
    }
    const maxRangeMs = 45 * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxRangeMs) {
      throw new BadRequestException('Maksymalny zakres to 45 dni');
    }

    const [weekly, absences, sessions] = await Promise.all([
      this.prisma.weeklyAvailability.findMany({ where: { artistId } }),
      this.prisma.artistAbsence.findMany({
        where: {
          artistId,
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      }),
      this.prisma.tattooSession.findMany({
        where: {
          artistId,
          status: { in: ACTIVE_SESSION },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      }),
    ]);

    const busy: Interval[] = [
      ...absences.map((a) => ({ start: a.startsAt, end: a.endsAt })),
      ...sessions.map((s) => ({ start: s.startsAt, end: s.endsAt })),
    ];

    const dayWindows: Interval[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(to);
    last.setHours(0, 0, 0, 0);

    while (cursor <= last) {
      const wd = isoWeekday(cursor);
      const rules = weekly.filter((w) => w.weekday === wd);
      for (const r of rules) {
        const start = minutesToDate(cursor, r.startMin);
        const end = minutesToDate(cursor, r.endMin);
        const clippedStart = start < from ? from : start;
        const clippedEnd = end > to ? to : end;
        if (clippedEnd > clippedStart) {
          dayWindows.push({ start: clippedStart, end: clippedEnd });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const free = subtractIntervals(dayWindows, busy);
    const durationMs = durationMinutes * 60 * 1000;
    const stepMs = 30 * 60 * 1000;
    const now = Date.now();
    const slots = sliceSlots(free, durationMs, stepMs).filter(
      (s) => s.start.getTime() >= now + 60 * 60 * 1000,
    );

    return {
      artistId,
      durationMinutes,
      slots: slots.map((s) => ({
        startsAt: s.start.toISOString(),
        endsAt: s.end.toISOString(),
      })),
    };
  }

  private assertCanManage(user: AuthUser, artistId: string) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.ARTIST && user.id === artistId) return;
    throw new ForbiddenException('Brak uprawnień do edycji grafiku');
  }

  private async assertArtistExists(artistId: string) {
    const artist = await this.prisma.user.findFirst({
      where: { id: artistId, role: Role.ARTIST, artistProfile: { active: true } },
    });
    if (!artist) {
      throw new NotFoundException('Nie znaleziono aktywnego artysty');
    }
  }
}
