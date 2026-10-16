# Database

PostgreSQL 17 + PostGIS 3.5 (works on PostgreSQL ≥ 15). Schema source of truth: `src/db/schema.ts` (Drizzle). Migrations: `database/migrations` (drizzle-kit journal, applied by `pnpm db:migrate`).

## Migrations

| File | Contents |
|---|---|
| `0000_extensions.sql` | `postgis`, `pg_trgm`, `citext`, `pgcrypto` |
| `0001_core_schema.sql` | All tables, constraints and indexes below |

Workflow: edit `schema.ts` → `pnpm db:generate` → review the SQL (drizzle-kit quotes custom types; `geography(Point,4326)` must be unquoted) → commit → `pnpm db:migrate`. Migrations are forward-only and must be backwards compatible with the previously deployed code.

## Tables

| Group | Tables |
|---|---|
| Identity | `users` (citext email, argon2 hash, platform role, status, deletion request), `sessions` (hashed tokens, web/mobile), `password_reset_tokens` |
| Taxonomy | `categories` (tree, scope product/shop), `brands` (+aliases), `search_synonyms`, `localities` (geography) |
| Shops | `shops` (status draft/pending/active/rejected/suspended, verification), `shop_members` (owner/manager/staff), `branches` (address, geography point, opening hours jsonb, one primary per shop) |
| Catalogue | `catalog_products` (identity_key unique among non-merged, specs jsonb, search_text + generated tsvector), `listings` (unique shop+product, lifecycle), `inventory` (unique listing+branch, price_minor > 0, quantity ≥ 0, mrp ≥ price, version), `inventory_history`, `media_assets`, `product_images` |
| Offers | `offers` (window & value CHECKs), `offer_listings` |
| Engagement | `enquiries` (idempotency unique (customer, client_request_id), quantity 1–10000), `enquiry_messages`, `favourite_products`, `favourite_shops`, `reviews` (rating 1–5, one per author per target, target CHECK) |
| Trust & safety | `reports`, `moderation_actions` |
| Monetisation | `plans` (entitlements jsonb, single default), `subscriptions` (one live per shop), `sponsored_placements` |
| Platform | `notifications`, `notification_preferences`, `analytics_events`, `search_logs`, `audit_logs`, `platform_settings`, `rate_limits`, `error_logs` |

## Key indexes

- GiST on `branches.location`, `localities.location`
- GIN on `catalog_products.search_vector`, trigram GIN on `catalog_products.search_text`, `shops.name`, `localities.name`
- `listings (catalog_product_id, status)`, `listings (shop_id, status)`, `inventory (listing_id, branch_id)` unique
- `analytics_events (shop_id, type, created_at)`, `enquiries (shop_id, status, last_message_at)`

## Money and time

Money is stored as integers in minor units (`price_minor`) with a `currency` column. Timestamps are `timestamptz`.
