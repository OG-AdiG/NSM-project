# Wskazówki dla agenta (Cursor)

Projekt pracy inżynierskiej: system studia tatuażu (web + API + iOS).

## Zasady

- Nie commituj sekretów (`.env`). Używaj `.env.example`.
- Trzymaj kod w monorepo: `apps/api`, `apps/web`, `apps/ios`, `packages/shared`.
- Nowe endpointy = walidacja DTO + Swagger + RBAC.
- Pliki (zdjęcia, dokumenty) idą do S3/MinIO, nie do gita.
- Checklist wymagań: `docs/wymagania.md`. Architektura: `docs/architektura.md`.
- Język UI i komunikatów: polski.
- Nie generuj zbędnych plików markdown poza `docs/` i README.

## Kolejność implementacji MVP

1. Auth (FR-01–FR-04)
2. Zgłoszenia + upload + kalkulator (FR-07–FR-12)
3. Grafik / rezerwacje + exclusion constraint (FR-13–FR-16)
4. Stripe zadatek (FR-19)
5. Dokumenty (FR-22–FR-23)
6. Panel admin (FR-26–FR-28)
7. iOS właściciela (FR-31–FR-32)
