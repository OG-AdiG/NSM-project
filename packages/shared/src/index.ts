/** Wspólne stałe / typy używane przez API i web. */

export const SUBMISSION_STATUSES = [
  'NEW',
  'QUOTED',
  'ACCEPTED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  NEW: 'Nowe',
  QUOTED: 'Wycenione',
  ACCEPTED: 'Zaakceptowane',
  COMPLETED: 'Zrealizowane',
  REJECTED: 'Odrzucone',
  CANCELLED: 'Anulowane',
};

export const USER_ROLES = ['CLIENT', 'ARTIST', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Dozwolone przejścia statusów (FR-12) — wycena liczbowa dojdzie w FR-11 */
export const SUBMISSION_STATUS_TRANSITIONS: Record<
  UserRole,
  Partial<Record<SubmissionStatus, readonly SubmissionStatus[]>>
> = {
  CLIENT: {
    NEW: ['CANCELLED'],
    QUOTED: ['ACCEPTED', 'CANCELLED'],
  },
  ARTIST: {
    NEW: ['QUOTED', 'REJECTED'],
    QUOTED: ['REJECTED'],
    ACCEPTED: ['COMPLETED'],
  },
  ADMIN: {
    NEW: ['QUOTED', 'REJECTED', 'CANCELLED'],
    QUOTED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
    ACCEPTED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    REJECTED: ['NEW'],
    CANCELLED: ['NEW'],
  },
};

export function allowedSubmissionStatuses(
  role: UserRole,
  current: SubmissionStatus,
): SubmissionStatus[] {
  return [...(SUBMISSION_STATUS_TRANSITIONS[role][current] ?? [])];
}

export function canEditSubmissionPhotos(status: SubmissionStatus): boolean {
  return status === 'NEW';
}

export function canDeleteSubmission(role: UserRole, status: SubmissionStatus): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'CLIENT') return status === 'NEW' || status === 'CANCELLED' || status === 'REJECTED';
  return false;
}

export const COLOR_MODES = ['BLACK_GREY', 'COLOR'] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  BLACK_GREY: 'Czerń / szarość',
  COLOR: 'Kolor',
};

/** Propozycje do formularza (FR-07) – klient może też wpisać własną wartość */
export const BODY_PART_OPTIONS = [
  'przedramię',
  'ramię',
  'nadgarstek',
  'dłoń',
  'bark',
  'klatka piersiowa',
  'plecy',
  'żebra',
  'udo',
  'łydka',
  'kostka',
  'szyja',
  'za uchem',
] as const;

export const SIZE_OPTIONS = [
  'mały (do 5 cm)',
  'średni (5–15 cm)',
  'duży (powyżej 15 cm)',
  'rękaw / większa powierzchnia',
] as const;

export const STYLE_OPTIONS = [
  'fineline',
  'minimal',
  'botaniczny',
  'realizm',
  'tradycyjny',
  'neotradicional',
  'blackwork',
  'geometryczny',
  'napis / litering',
  'inny',
] as const;

export const AUTH_ROUTES = {
  register: '/rejestracja',
  login: '/logowanie',
  account: '/konto',
  verifyEmail: '/weryfikacja-email',
  forgotPassword: '/przypomnij-haslo',
  resetPassword: '/reset-hasla',
} as const;

/** Limity uploadu zdjęć referencyjnych (FR-08) */
export const REFERENCE_PHOTO = {
  maxFiles: 5,
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;
