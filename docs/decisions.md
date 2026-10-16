# Technical decisions and assumptions

Each entry: decision, reason, consequence.

1. **Self-hosted authentication instead of Supabase Auth.** No Supabase project or credentials were available, and a provider-independent session model is easier to test end-to-end. Passwords use argon2id (OWASP parameters); sessions are opaque 256-bit tokens stored as SHA-256 hashes, delivered as an httpOnly SameSite=Lax cookie (web) or a bearer token (mobile). *Consequence:* no social login yet; email verification and MFA are deferred. Moving to Supabase Auth later means replacing `src/modules/auth/*` while keeping `Ctx`.
2. **Plain PostgreSQL + PostGIS (Supabase-compatible).** Migrations only use extensions available on Supabase (`postgis`, `pg_trgm`, `citext`, `pgcrypto`). Local dev uses the `postgis/postgis:17-3.5` image.
3. **Authorisation in application services, not Row Level Security.** All database access goes through the server with a single privileged role; RLS would duplicate the permission matrix. If the database is ever exposed directly to clients (e.g. Supabase client SDK), RLS policies must be added first.
4. **Next.js `cacheComponents` disabled; every page renders dynamically.** Price and stock correctness outweighs caching. Static assets and images are still cached.
5. **No service worker.** A PWA manifest makes the app installable, but offline caching of search/stock could present outdated availability as current. Revisit with explicit "last updated" offline UI.
6. **PostgreSQL search, staged matching.** Exact full-text (with synonyms + prefix) → partial (any word) → fuzzy trigram. The first stage with results wins so typo tolerance never pollutes exact matches. No external search engine until data volume demands it (see `docs/search.md`).
7. **Offer expiry by query, not by job.** `active = published AND starts_at <= now() < ends_at`. No scheduler is needed for correctness.
8. **Rate limiting in Postgres** (fixed window, `rate_limits` table) so it works across instances without Redis. Swap for Redis/edge limits at higher traffic.
9. **Email via a driver boundary.** Only a `log` driver exists; notifications are stored in-app and email delivery runs after commit (`deliverPendingEmails`) with `pending/sent/failed` tracking. A real provider must be configured before launch (password reset depends on it).
10. **Billing not implemented.** Plans/entitlements are fully functional and enforced server-side; paid plans are assigned manually by admins (`provider = "manual"`). No payment success is ever simulated.
11. **Media re-encoded to WebP** with sharp (EXIF/GPS metadata stripped, max 1600px, 5 MB upload limit, magic-byte type check). Local disk driver for dev; Supabase Storage driver implemented against its REST API but **not verified** without credentials.
12. **Maps:** MapLibre GL with OpenFreeMap tiles (no key). Geocoding uses a built-in localities table first and an optional Nominatim-compatible geocoder (server-side, rate limited, 4 s timeout, graceful fallback). Directions open Google Maps with the destination; Locafy never computes routes or travel times.
13. **Default market India** (INR, `en-IN`, Asia/Kolkata for opening hours). Currency/locale are configurable; per-shop timezones are deferred.
14. **Merchant-created catalogue entries are shared.** A merchant can edit a catalogue product only if they created it and no other shop lists it; otherwise corrections go through reports → admin.
15. **Reviews are never labelled "verified purchase"** — Locafy has no purchase evidence.
16. **Account deletion is a request processed by an admin** (anonymisation, session revocation, sole-owned shops suspended). Fully automatic deletion is deferred.
17. **Blue + Slate design system.** Primary `#2563EB`, slate neutrals, navy headings, amber only for offers, status green/amber/red. Tokens are defined once in platform-independent `src/design/tokens.json` (for future native apps) and mirrored in CSS; a unit test enforces sync and WCAG AA contrast for every text pair in use. White header and a light-blue hero panel instead of solid blue/gradient backgrounds, per the minimal SaaS direction. See `docs/design-system.md`.
