/** Wspólne stałe / typy używane przez API i web (docelowo także kontrakt OpenAPI). */

export const SUBMISSION_STATUSES = [
  'NEW',
  'QUOTED',
  'ACCEPTED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
] as const;

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const USER_ROLES = ['CLIENT', 'ARTIST', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Publiczne ścieżki auth (web) */
export const AUTH_ROUTES = {
  register: '/rejestracja',
  login: '/logowanie',
  account: '/konto',
  verifyEmail: '/weryfikacja-email',
  forgotPassword: '/przypomnij-haslo',
  resetPassword: '/reset-hasla',
} as const;
