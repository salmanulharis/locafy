# Deployment, operations and recovery

## Environments

| | Development | Staging | Production |
|---|---|---|---|
| Database | Docker PostGIS (`pnpm db:up`) | Managed Postgres (e.g. Supabase) — separate project | Managed Postgres, PITR enabled |
| Demo data | `pnpm db:seed:demo` | Optional, clearly labelled | **Never** (script refuses when `NODE_ENV=production`) |
| `STORAGE_DRIVER` | `local` | `supabase` | `supabase` (or S3-compatible adapter) |
| `MAIL_DRIVER` | `log` | provider sandbox | provider (to be implemented) |

Each environment has its own `.env` / secret store; never share databases between environments.

## Production setup

1. Provision PostgreSQL ≥ 15 with `postgis`, `pg_trgm`, `citext`, `pgcrypto` available (Supabase: enable in Database → Extensions or let migration 0000 do it).
2. Set environment variables from `.env.example` in the host's secret manager. Required: `DATABASE_URL`, `APP_URL` (https), `NODE_ENV=production`. Set `STORAGE_DRIVER`, `SUPABASE_*`, `STORAGE_PUBLIC_HOST`, `GEOCODER_CONTACT_EMAIL` (required by the Nominatim usage policy, or point `GEOCODER_URL` at a commercial geocoder).
3. `pnpm install --frozen-lockfile && pnpm build`
4. `pnpm db:migrate` (run as a release step, before switching traffic)
5. `pnpm db:seed` (reference data; idempotent)
6. `ADMIN_PASSWORD=… pnpm db:create-admin ops@example.com "Ops Admin"`
7. `pnpm start` (Node ≥ 20.9) behind HTTPS. Health check: `GET /api/health` (200 = DB reachable, 503 otherwise).

The app is a standard Node server (`next start`); it runs on any container platform, VM or Vercel. `sharp` and `@node-rs/argon2` are native modules — build on the target OS/arch (or use the provided prebuilt binaries for linux-x64/arm64).

## Background tasks

Correctness never depends on jobs (offer expiry is computed). Recommended periodic tasks (cron / platform scheduler):

| Task | Function | Frequency |
|---|---|---|
| Send pending notification emails | `deliverPendingEmails()` (`src/modules/notifications/service.ts`) | every minute, once a mail driver exists |
| Purge expired sessions | `purgeExpiredSessions()` (`src/modules/auth/sessions.ts`) | daily |
| Trim `rate_limits`, `search_logs` > 90 d, `analytics_events` > 13 months | SQL | daily |

## Backups and recovery

- Enable automated daily backups **and point-in-time recovery** on the managed database (Supabase Pro / RDS). Retention ≥ 7 days (staging) / ≥ 30 days (production).
- Media: enable bucket versioning or replication on object storage.
- Restore drill (do before launch and quarterly):
  1. Restore the latest backup into a new database instance.
  2. Point a staging deployment at it (`DATABASE_URL`), run `pnpm db:migrate` (no-op if up to date).
  3. Verify `GET /api/health`, sign in as admin, run a search, open a shop.
  4. Record RTO/RPO achieved.
- Logical export for portability: `pg_dump --format=custom --no-owner "$DATABASE_URL" > locafy.dump` and `pg_restore --no-owner -d "$TARGET_URL" locafy.dump`.

## Monitoring

- Uptime check on `/api/health`.
- Application errors are written to `error_logs` (visible in Admin → Errors) and printed as JSON lines to stdout for log aggregation; add Sentry/OpenTelemetry via `instrumentation.ts` for production alerting.
- Search latency and zero-result rate: Admin → Overview (from `search_logs`).

## Rollback

Migrations are forward-only; write additive migrations and deploy code that tolerates both schemas. For an urgent rollback, redeploy the previous build (schema stays), or restore via PITR for destructive data incidents.
