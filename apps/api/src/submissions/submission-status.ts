import { Role, SubmissionStatus } from '@prisma/client';

/** Spójne z @nsm/shared — wycena/odrzucenie osobnymi endpointami */
const TRANSITIONS: Record<
  Role,
  Partial<Record<SubmissionStatus, readonly SubmissionStatus[]>>
> = {
  CLIENT: {
    NEW: [SubmissionStatus.CANCELLED],
    QUOTED: [SubmissionStatus.ACCEPTED, SubmissionStatus.CANCELLED],
  },
  ARTIST: {
    ACCEPTED: [SubmissionStatus.COMPLETED],
  },
  ADMIN: {
    NEW: [SubmissionStatus.CANCELLED],
    QUOTED: [SubmissionStatus.ACCEPTED, SubmissionStatus.CANCELLED],
    ACCEPTED: [SubmissionStatus.COMPLETED, SubmissionStatus.CANCELLED],
    REJECTED: [SubmissionStatus.NEW],
    CANCELLED: [SubmissionStatus.NEW],
  },
};

export function allowedNextStatuses(role: Role, current: SubmissionStatus): SubmissionStatus[] {
  return [...(TRANSITIONS[role][current] ?? [])];
}

export function canEditPhotos(status: SubmissionStatus): boolean {
  return status === SubmissionStatus.NEW;
}

/** Twarde usunięcie (z plikami) — tylko admin */
export function canHardDelete(role: Role, _status: SubmissionStatus): boolean {
  return role === Role.ADMIN;
}

/** Soft-delete → archiwum — tylko admin */
export function canArchive(role: Role, _status: SubmissionStatus): boolean {
  return role === Role.ADMIN;
}

export function canDeleteOrArchive(role: Role, status: SubmissionStatus): boolean {
  return canHardDelete(role, status) || canArchive(role, status);
}
