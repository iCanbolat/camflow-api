# CamFlow API — Operations Runbook

NestJS 11 + Drizzle (Postgres) + Redis/BullMQ + Bunny.net. See `.claude/API-PROGRESS.md`
for the full phase history.

## Prerequisites

- Node 22, pnpm 10
- Postgres 16, Redis 7
- (prod media) a Bunny.net Edge Storage zone + Pull Zone
- (prod push) an APNs auth key (`.p8`)
- (prod video) `ffmpeg` on the worker host

## Configuration

All config is environment-driven and validated at boot (`src/common/config/env.ts`,
fail-fast). Copy `.env.example` → `.env` and fill it in. Key groups:

| Group | Vars |
|---|---|
| Core | `NODE_ENV`, `PORT`, `CORS_ORIGINS` |
| Database | `DATABASE_URL` |
| Redis | `REDIS_URL` |
| Auth | `JWT_ACCESS_SECRET` (≥32 chars), `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL_DAYS` |
| Social | `APPLE_CLIENT_ID`, `GOOGLE_CLIENT_ID` |
| Storage | `STORAGE_DRIVER` (`local`/`bunny`), `BUNNY_*`, `API_PUBLIC_URL` |
| Push | `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION` |
| Ops | `BULL_BOARD_USER/PASSWORD`, `SWAGGER_ENABLED`, `CLEANUP_ENABLED`, `TOMBSTONE_RETENTION_DAYS`, `REFRESH_TOKEN_GRACE_DAYS` |

Secrets (`JWT_ACCESS_SECRET`, `BUNNY_*`, `APNS_KEY_P8`, DB/Redis URLs) come from the
platform secret store — never commit `.env`.

## Local development

```bash
docker compose up -d        # Postgres 16 + Redis 7
cp .env.example .env
pnpm install
pnpm db:migrate             # apply migrations
pnpm db:seed                # demo account + 2 orgs (demo@camflow.app / password)
pnpm start:dev
```

- API: `http://localhost:3000/api/v1`, health: `/health`
- OpenAPI docs: `http://localhost:3000/docs`
- Queue dashboard: `http://localhost:3000/admin/queues` (basic auth)
- Media in dev uses the `local` storage driver (files under `STORAGE_LOCAL_DIR`).

## Database & migrations

- Schema lives in `src/database/schema/*`; **Drizzle is the source of truth**.
- Change a table → `pnpm db:generate` (creates `drizzle/NNNN_*.sql`) → commit it.
- `pnpm db:migrate` applies pending migrations. The Docker image runs it on boot
  (`drizzle-kit migrate && node dist/main`), so deploys are migrate-then-start.
- CI fails on schema drift (migrations out of sync with the schema).

## Production (Docker)

```bash
docker build -t camflow-api .
docker run --env-file .env -p 3000:3000 camflow-api
```

The image is multi-stage (build → prune → slim runtime) and migrates on start.

### Scaling workers

API and BullMQ workers run in-process by default. To scale processing
independently, run extra replicas of the same image — every instance hosts the
`media-process`, `push-send`, and `cleanup` workers and shares the Redis queues.
BullMQ distributes jobs across them. Set `CLEANUP_ENABLED=false` on all but one
replica is **not** required (repeatable jobs dedupe by repeat key), but the
cleanup *worker* should run on at least one.

## Media pipeline (Bunny.net)

- Clients never send base64. `POST /media/upload-ticket` → client streams raw
  bytes to `PUT /media/upload?token=` (authenticated streaming proxy) → `POST
  /media/commit` enqueues processing.
- `media-process` worker: sharp (compress/thumb/watermark) for photos, ffmpeg
  for video, then re-uploads derivatives and deletes the raw object.
- Downloads use signed Pull Zone URLs (`GET /media/:id/urls`).
- Switch to prod by setting `STORAGE_DRIVER=bunny` + the `BUNNY_*` vars.

## Push notifications (APNs)

- Backend is ready; remote push is a **no-op until `APNS_*` are set**.
- iOS still needs the `aps-environment` entitlement, `registerForRemoteNotifications`,
  and permission priming before tokens arrive at `POST /devices`.
- `push-send` worker badges with the unread count and prunes dead tokens.

## Retention / cleanup

Daily repeatable jobs on the `cleanup` queue:

- **refresh-tokens** — drop expired/revoked tokens older than `REFRESH_TOKEN_GRACE_DAYS`.
- **tombstones** — hard-delete rows soft-deleted beyond `TOMBSTONE_RETENTION_DAYS`
  (must exceed the 7-day device purge so all devices sync the delete first).
- **idempotency keys** — handled automatically by Redis TTL (7 days); no job needed.

## Observability & security checklist

- `/health` (db + redis) for liveness/readiness probes.
- Structured logs via pino (auth/cookie headers redacted).
- `helmet`, CORS allow-list, `trust proxy` for correct client IPs.
- Rate limiting via `@nestjs/throttler` backed by Redis (cross-instance); auth
  routes are tightened with `@Throttle`.
- Global `JwtAuthGuard` (`@Public()` opt-out); org routes gated by `OrgScopeGuard`
  + `PermissionsGuard`; SSE + Bull Board authenticated.
- In production, keep `/docs` off unless `SWAGGER_ENABLED=true`, and put Bull
  Board behind strong credentials / network policy.

## CI

`.github/workflows/ci.yml` runs on push/PR: install → lint → build → migrate
drift check → unit tests → testcontainers e2e (Postgres + Redis).
