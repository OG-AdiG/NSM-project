import { Role, SubmissionStatus } from '@prisma/client';

/** Spójne z @nsm/shared SUBMISSION_STATUS_TRANSITIONS (FR-12) */
const TRANSITIONS: Record<
  Role,
  Partial<Record<SubmissionStatus, readonly SubmissionStatus[]>>
> = {
  CLIENT: {
    NEW: [SubmissionStatus.CANCELLED],
    QUOTED: [SubmissionStatus.ACCEPTED, SubmissionStatus.CANCELLED],
  },
  ARTIST: {
    NEW: [SubmissionStatus.QUOTED, SubmissionStatus.REJECTED],
    QUOTED: [SubmissionStatus.REJECTED],
    ACCEPTED: [SubmissionStatus.COMPLETED],
  },
  ADMIN: {
    NEW: [SubmissionStatus.QUOTED, SubmissionStatus.REJECTED, SubmissionStatus.CANCELLED],
    QUOTED: [SubmissionStatus.ACCEPTED, SubmissionStatus.REJECTED, SubmissionStatus.CANCELLED],
    ACCEPTED: [SubmissionStatus.COMPLETED, SubmissionStatus.CANCELLED],
    COMPLETED: [],
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

export function canDeleteSubmission(role: Role, status: SubmissionStatus): boolean {
  if (role === Role.ADMIN) return true;
  if (role === Role.CLIENT) {
    return (
      status === SubmissionStatus.NEW ||
      status === SubmissionStatus.CANCELLED ||
      status === SubmissionStatus.REJECTED
    );
  }
  return false;
}
