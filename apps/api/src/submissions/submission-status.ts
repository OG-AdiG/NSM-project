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

export function canHardDelete(role: Role, status: SubmissionStatus): boolean {
  if (role === Role.ARTIST) return false;
  return (
    status === SubmissionStatus.NEW ||
    status === SubmissionStatus.CANCELLED ||
    status === SubmissionStatus.REJECTED
  );
}

export function canArchive(role: Role, status: SubmissionStatus): boolean {
  if (role === Role.ARTIST) return false;
  if (role === Role.ADMIN) {
    return (
      status === SubmissionStatus.QUOTED ||
      status === SubmissionStatus.ACCEPTED ||
      status === SubmissionStatus.COMPLETED
    );
  }
  if (role === Role.CLIENT) {
    return status === SubmissionStatus.QUOTED || status === SubmissionStatus.ACCEPTED;
  }
  return false;
}

export function canDeleteOrArchive(role: Role, status: SubmissionStatus): boolean {
  return canHardDelete(role, status) || canArchive(role, status);
}
