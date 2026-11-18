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

/**
 * Przejścia przez ogólny PATCH /status.
 * Wycena (→ QUOTED) i odrzucenie (→ REJECTED) idą osobnymi endpointami z kwotą / powodem.
 */
export const SUBMISSION_STATUS_TRANSITIONS: Record<
  UserRole,
  Partial<Record<SubmissionStatus, readonly SubmissionStatus[]>>
> = {
  CLIENT: {
    NEW: ['CANCELLED'],
    QUOTED: ['ACCEPTED', 'CANCELLED'],
  },
  ARTIST: {
    ACCEPTED: ['COMPLETED'],
  },
  ADMIN: {
    NEW: ['CANCELLED'],
    QUOTED: ['ACCEPTED', 'CANCELLED'],
    ACCEPTED: ['COMPLETED', 'CANCELLED'],
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

/** Twarde usunięcie (plików + rekordu) — tylko wczesne statusy */
export function canHardDeleteSubmission(role: UserRole, status: SubmissionStatus): boolean {
  if (role === 'ARTIST') return false;
  return status === 'NEW' || status === 'CANCELLED' || status === 'REJECTED';
}

/** Soft-delete / archiwum — po wycenie lub akceptacji */
export function canArchiveSubmission(role: UserRole, status: SubmissionStatus): boolean {
  if (role === 'ARTIST') return false;
  if (role === 'ADMIN') {
    return status === 'QUOTED' || status === 'ACCEPTED' || status === 'COMPLETED';
  }
  if (role === 'CLIENT') {
    return status === 'QUOTED' || status === 'ACCEPTED';
  }
  return false;
}

export function canDeleteSubmission(role: UserRole, status: SubmissionStatus): boolean {
  return canHardDeleteSubmission(role, status) || canArchiveSubmission(role, status);
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

export type PriceEstimateInput = {
  size: string;
  style: string;
  colorMode: ColorMode;
  bodyPart: string;
};

export type PriceEstimate = {
  minPln: number;
  maxPln: number;
  suggestedSessions: number;
  breakdown: string[];
};

/** Kalkulator widełek (FR-09) — reguły orientacyjne, parametry admina w FR-27 */
export function estimateTattooPrice(input: PriceEstimateInput): PriceEstimate {
  const size = input.size.toLowerCase();
  const style = input.style.toLowerCase();
  const part = input.bodyPart.toLowerCase();
  const breakdown: string[] = [];

  let base = 350;
  if (size.includes('mały') || size.includes('do 5')) {
    base = 250;
    breakdown.push('Rozmiar mały: baza 250 zł');
  } else if (size.includes('średni') || size.includes('5–15') || size.includes('5-15')) {
    base = 450;
    breakdown.push('Rozmiar średni: baza 450 zł');
  } else if (size.includes('rękaw') || size.includes('większa')) {
    base = 1200;
    breakdown.push('Duża powierzchnia / rękaw: baza 1200 zł');
  } else if (size.includes('duży') || size.includes('powyżej')) {
    base = 800;
    breakdown.push('Rozmiar duży: baza 800 zł');
  } else {
    breakdown.push('Rozmiar niestandardowy: baza 350 zł');
  }

  let styleMult = 1;
  if (style.includes('realizm')) {
    styleMult = 1.45;
    breakdown.push('Styl realizm: +45%');
  } else if (style.includes('blackwork')) {
    styleMult = 1.25;
    breakdown.push('Styl blackwork: +25%');
  } else if (style.includes('neo') || style.includes('tradyc')) {
    styleMult = 1.2;
    breakdown.push('Styl tradycyjny/neo: +20%');
  } else if (style.includes('fineline') || style.includes('minimal')) {
    styleMult = 1.05;
    breakdown.push('Styl fineline/minimal: +5%');
  } else if (style.includes('botanic') || style.includes('geometr')) {
    styleMult = 1.15;
    breakdown.push('Styl botaniczny/geometryczny: +15%');
  }

  let colorMult = input.colorMode === 'COLOR' ? 1.2 : 1;
  if (input.colorMode === 'COLOR') breakdown.push('Kolor: +20%');
  else breakdown.push('Czerń/szarość: bez dopłaty');

  let partMult = 1;
  if (part.includes('żeb') || part.includes('szyj') || part.includes('uch') || part.includes('dłoń') || part.includes('kostk')) {
    partMult = 1.15;
    breakdown.push('Miejsce trudniejsze technicznie: +15%');
  } else if (part.includes('plec') || part.includes('klatk') || part.includes('udo')) {
    partMult = 1.1;
    breakdown.push('Większa okolica: +10%');
  }

  const mid = Math.round(base * styleMult * colorMult * partMult);
  const minPln = Math.round(mid * 0.85 / 10) * 10;
  const maxPln = Math.round(mid * 1.25 / 10) * 10;
  const suggestedSessions = maxPln >= 1500 ? 3 : maxPln >= 900 ? 2 : 1;

  return { minPln, maxPln, suggestedSessions, breakdown };
}
