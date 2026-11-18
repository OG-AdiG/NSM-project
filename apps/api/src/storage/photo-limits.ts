/** Limity uploadu zdjęć referencyjnych (FR-08) — spójne z @nsm/shared REFERENCE_PHOTO */
export const REFERENCE_PHOTO = {
  maxFiles: 5,
  maxBytes: 5 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
} as const;
