# Architektura (szkielet)

Zgodnie z założeniami z rozdziału 1.7 pracy.

```text
                 ┌──────────────────────┐
                 │  apps/web (Next.js)  │  klient + panel admin
                 └──────────┬───────────┘
                            │ HTTPS / REST
                 ┌──────────▼───────────┐
   apps/ios ────►│  apps/api (NestJS)   │◄──── Stripe webhooks
   (SwiftUI)     │  JWT · Swagger       │
                 └────┬─────┬─────┬─────┘
                      │     │     │
              ┌───────▼┐ ┌──▼──┐ ┌▼────────┐
              │Postgres│ │Redis│ │MinIO/S3 │
              │ Prisma │ │BullMQ│ │pliki   │
              └────────┘ └─────┘ └─────────┘
```

## Pakiety w monorepo

| Ścieżka | Rola |
| --- | --- |
| `apps/api` | REST API (NestJS + Prisma + PostgreSQL) |
| `apps/web` | Aplikacja webowa (Next.js + Tailwind) |
| `apps/ios` | Aplikacja właściciela (SwiftUI) – placeholder |
| `packages/shared` | Wspólne typy / stałe |
| `docker/` | Wolumeny lokalne, przyszły Nginx |
| `docs/` | Wymagania, architektura, notatki do pracy |

## Zasady „bez syfu”

1. **Sekrety tylko w `.env`** (skopiuj z `.env.example`). Nigdy w gicie.
2. **Jeden lockfile** (`pnpm-lock.yaml`) w root – instalacja tylko przez `pnpm install` z roota.
3. **Kod domenowy w API**, web tylko UI + wywołania API; iOS też tylko klient API.
4. **Migracje Prisma** w `apps/api/prisma/migrations` – żadnych ręcznych zmian w prod DB.
5. **Pliki użytkowników** w S3/MinIO, nie w repo i nie w `public/` Next.js.
6. **Feature branches + PR**; CI (`/.github/workflows/ci.yml`) musi przejść przed merge.
7. Checklist FR/NFR: `docs/wymagania.md`.

## Porty (dev)

| Usługa | Port |
| --- | --- |
| Next.js | 3000 |
| NestJS API | 3001 |
| Swagger | 3001/api/docs |
| PostgreSQL | 5433 (host → 5432 w kontenerze) |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| Mailpit SMTP | 1025 |
| Mailpit UI | 8025 |

## Pliki (MinIO / FR-08)

- Bucket prywatny: `S3_BUCKET` (`nsm-files`) — zdjęcia referencyjne zgłoszeń.
- Upload: `POST /api/submissions/:id/photos` (multipart, pole `file`).
- Usuwanie: `DELETE /api/submissions/:id/photos/:photoId`.
- Podgląd: podpisane URL GET (TTL ~15 min) w odpowiedzi szczegółów zgłoszenia.
- Na serwerze Docker: `docker compose up -d minio` (obraz `bitnamilegacy/minio`).
- `S3_ENDPOINT` musi być osiągalny z przeglądarki (IP LAN, nie `localhost` z Windows → serwer).

## Rezerwacje (FR-13–16)

- Grafik: `WeeklyAvailability` + `ArtistAbsence` (`PUT/GET /artists/:id/availability`, absences).
- Wolne sloty: `GET /artists/:id/slots?from&to&durationMinutes`.
- Sesje: `TattooSession` + Postgres `EXCLUDE USING gist` (brak nachodzenia aktywnych sesji artysty).
- Wielosesyjność: `sessionIndex` + `sessionCount` ze zgłoszenia (`GET /sessions/project/:submissionId`).
- UI: `/grafik`, `/rezerwacje`, panel rezerwacji na zgłoszeniu ACCEPTED.
