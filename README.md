# Locafy

**Find what you need. Compare nearby options. Know what is available. Find the shop.**

Locafy is a local product discovery, price comparison and shop visibility platform. Customers search for a product and see which nearby shops stock it, at what price, how fresh the stock information is, and how to get there. Shop owners get a free digital storefront with product, stock, offer and enquiry management. Administrators approve shops and moderate the platform.

- Web-first, mobile-first responsive Next.js app (installable PWA)
- Versioned JSON API (`/api/v1`) sharing the same services, ready for native Android/iOS apps
- PostgreSQL + PostGIS for data integrity and geographic search

## Documentation

| Doc | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System design, domains, data model |
| [docs/conventions.md](docs/conventions.md) | How to add code (layers, forms, API, UI rules) |
| [docs/api.md](docs/api.md) | API v1 reference, auth, errors, pagination, rate limits |
| [docs/mobile.md](docs/mobile.md) | Native app integration strategy |
| [docs/search.md](docs/search.md) | Matching, ranking, sponsored results |
| [docs/security.md](docs/security.md) | Security controls |
| [docs/decisions.md](docs/decisions.md) | Significant decisions and assumptions |
| [docs/deployment.md](docs/deployment.md) | Production setup, jobs, backups and recovery |
| [docs/integrations.md](docs/integrations.md) | External services: status and setup |
| [docs/database.md](docs/database.md) | Schema reference and migrations |
| [docs/design-system.md](docs/design-system.md) | Blue + Slate colour tokens, contrast, usage rules |

## Requirements

- Node.js ≥ 20.9 (developed on 24), pnpm 11
- Docker (for the local PostGIS database) — or any PostgreSQL ≥ 15 with PostGIS

## Local development

```bash
pnpm install
cp .env.example .env              # defaults work with the Docker database
pnpm db:up                         # PostgreSQL 17 + PostGIS on localhost:54329 (creates locafy, locafy_test, locafy_e2e)
pnpm db:migrate                    # apply migrations
pnpm db:seed                       # reference data: categories, plans, synonyms, localities
pnpm db:seed:demo                  # OPTIONAL dev-only demo shops/products around Kochi
pnpm dev                           # http://localhost:3000
```

Demo accounts (only after `db:seed:demo`, password `Demo-pass-123`):

| Email | Role |
|---|---|
| `admin@locafy.test` | Super admin (`/admin`) |
| `merchant1@locafy.test` | Owner of "Demo Mobiles Edappally" |
| `merchant2@locafy.test` | Owner of "Demo Fresh Mart Kakkanad" |
| `merchant3@locafy.test` | Owner of "Demo Hardware Vyttila" (stock deliberately 20 days old) |
| `customer@locafy.test` | Customer |

All demo shop names start with "Demo"; their prices and stock are illustrative only. Never run the demo seed outside development (it refuses when `NODE_ENV=production`).

Useful scripts:

| Command | Purpose |
|---|---|
| `pnpm db:reset` | Drop and rebuild the local database (refuses non-local hosts) |
| `pnpm db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `ADMIN_PASSWORD=… pnpm db:create-admin you@example.com "Your Name"` | Create/promote a super admin |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | Static checks |

## Tests

```bash
pnpm test:unit           # pure business rules
pnpm test:integration    # services against TEST_DATABASE_URL (reset automatically)
pnpm build && pnpm test:e2e   # Playwright against a production build on :3100 using E2E_DATABASE_URL
```

Integration and E2E tests each use their own disposable database and never touch development data.

## Production

See [docs/deployment.md](docs/deployment.md). In short: provision Postgres with PostGIS, set the environment variables, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`, create an admin, `pnpm start` behind HTTPS, monitor `GET /api/health`.

## Environment variables

See [.env.example](.env.example) — every variable is documented there. Required in production: `DATABASE_URL`, `APP_URL`, `NODE_ENV=production`; plus storage, geocoder contact and (once implemented) mail settings.

## Project status

This is an MVP for a controlled pilot. Not yet implemented: real email delivery, online payments, push notifications, email verification/MFA, bulk import, offline mode. See the deferred list in [docs/decisions.md](docs/decisions.md) and [docs/integrations.md](docs/integrations.md).
