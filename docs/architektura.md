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
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| Mailpit SMTP | 1025 |
| Mailpit UI | 8025 |
