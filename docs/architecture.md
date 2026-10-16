# Locafy architecture

## Overview

Locafy is a **modular monolith**: one Next.js 16 application serving the responsive web UI, server actions and a versioned JSON API (`/api/v1`), backed by PostgreSQL 17 + PostGIS. Business logic lives in framework-independent domain services so the same rules serve the web app today and native mobile apps later.

```
 Browser (web, PWA)              Future Android / iOS
   │  Server Components             │
   │  Server Actions (cookie)       │  HTTPS JSON, Authorization: Bearer
   ▼                                ▼
 src/app  (routes: pages · actions.ts · api/v1/*/route.ts)   ← thin transport layer
   │            parse input → call service → render / JSON
   ▼
 src/modules/<domain>/service.ts   ← authorisation, validation, transactions, audit
 src/modules/<domain>/rules.ts     ← pure business rules (unit-tested)
   │
   ▼
 src/db (Drizzle ORM)  →  PostgreSQL + PostGIS + pg_trgm
```

## Directory layout

| Path | Responsibility |
|---|---|
| `src/app/(public)` | Customer site: home, search, product, shop, offers, saved, account, auth |
| `src/app/merchant` | Shop owner dashboard |
| `src/app/admin` | Super admin console |
| `src/app/api/v1` | Versioned JSON API (mobile-ready), see `docs/api.md` |
| `src/components/{ui,forms,layout,products,shops,search,maps,feedback,merchant,admin}` | Presentation only |
| `src/modules/*` | Domain services and rules (below) |
| `src/lib` | Errors, HTTP/API wrapper, action wrapper, validation, money, location cookie |
| `src/db` | Drizzle schema and connection pool |
| `database/migrations` | Versioned SQL migrations (drizzle-kit journal) |
| `database/seeds` | `base.ts` reference data (all envs), `demo.ts` dev-only demo data |
| `database/scripts` | migrate, reset (dev only), create-admin |
| `tests/unit`, `tests/integration`, `e2e` | Vitest unit, Vitest DB integration, Playwright |

## Domains (`src/modules`)

| Module | Responsibility |
|---|---|
| `auth` | Registration, login, sessions (cookie + bearer), password reset/change, deletion requests, request context (`Ctx`) |
| `access` | Platform roles and the shop permission matrix (`SHOP_PERMISSIONS`) |
| `shops` | Shop onboarding, branches, opening hours, submission, team members, public shop view |
| `catalog` | Shared product identity, brands, categories, search text maintenance |
| `listings` | A shop's offer of a catalogue product, lifecycle (draft → published …), images |
| `inventory` | Branch-level price & stock, optimistic concurrency, change history, freshness rules |
| `search` | Staged full-text / partial / fuzzy matching, PostGIS radius, ranking, sponsored slot, alternatives |
| `products` | Product detail + seller comparison |
| `discovery` | Home feeds: nearby products, popular (real views only), nearby shops, shop catalogue |
| `offers` | Time-bounded discounts over listings; phase computed from time (expiry needs no job) |
| `enquiries` | Structured customer ↔ shop conversations with a state machine and idempotency |
| `favourites` | Saved products and shops |
| `reviews` | Shop/product reviews, merchant responses, edit window |
| `reports` | User reports for moderation |
| `administration` | Admin operations: approvals, moderation, catalogue merge, plans, sponsored, audit |
| `subscriptions` | Plans and central entitlement checks |
| `notifications` | In-app notifications, preferences, email delivery after commit (mail driver boundary) |
| `analytics` | Event recording and merchant statistics |
| `media` | Image validation/re-encoding and storage drivers (local / Supabase) |
| `geo` | PostGIS SQL helpers, locality search, geocoder boundary, directions links |
| `platform` | Rate limiting, audit log, error log |

## Core data model

Five concepts are kept separate (see `src/db/schema.ts`):

1. **`catalog_products`** — shared product identity. Uniqueness via `identity_key = brand|model-or-name|variant` (normalised). Variants are separate products, so "8 GB / 128 GB" and "8 GB / 256 GB" are never compared as the same item.
2. **`listings`** — one shop's offer of a catalogue product (`unique(shop_id, catalog_product_id)`).
3. **`inventory`** — branch-specific price and stock for a listing (`unique(listing_id, branch_id)`), with `version` for optimistic concurrency and CHECK constraints (price > 0, quantity ≥ 0, MRP ≥ price).
4. **`offers`** + `offer_listings` — validity window enforced by constraint; "active" is derived from `now()` so expired offers can never stay active.
5. **`inventory_history`** — append-only log of every price/stock change with actor and source.

Shops have `branches` with a PostGIS `geography(Point,4326)` location (GiST indexed). A branch without coordinates is excluded from distance search.

## Request lifecycle

- `getCtx()` / `getRequestCtx(req)` resolve the session from the `locafy_session` cookie **or** an `Authorization: Bearer` token into a `Ctx` (`actor`, ip, user agent, request id, auth method).
- Services call `requireUser`, `requireAdmin`, or `requireShopPermission(ctx, shopId, permission)`; non-members get `NOT_FOUND` so shop identifiers are not disclosed.
- Mutations that must be consistent run in a transaction; inventory updates take a row lock (`SELECT … FOR UPDATE`).
- `AppError`s map to user-safe messages (`runAction` for forms, `api()` for JSON). Unexpected errors are logged to `error_logs` with a request id and never shown to users.

## Security model (summary)

See `docs/security.md`.

## Mobile readiness

All operations exposed to the web UI are also reachable through `/api/v1` and share the same services. Authentication for native clients uses bearer tokens backed by the same `sessions` table. See `docs/api.md` and `docs/mobile.md`.
