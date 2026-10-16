# Locafy HTTP API (`/api/v1`)

The versioned JSON API serves the web app's client-side calls and future native Android/iOS apps. Every endpoint is a thin route handler (`src/app/api/v1/**/route.ts`) over the same application services that the web UI uses (`src/modules/*`). Permission checks, validation, limits and rate limiting all live in those services, so the API and the web UI behave the same way.

## Base URL and versioning

- Base URL: `https://<host>/api/v1` (dev: `http://localhost:3000/api/v1`).
- **Within v1, changes are additive only.** We may add new endpoints, new optional request fields, new response fields and new error `details`. We will not remove or rename fields, change field types or meanings, or make optional inputs required.
- Clients must ignore unknown response fields and unknown enum values (show a generic fallback).
- Breaking changes ship as `/api/v2`. v1 keeps running alongside it for a published deprecation period.
- `GET /api/health` (unversioned) is the liveness probe.

## Conventions

| Topic | Rule |
| --- | --- |
| Request bodies | JSON with `Content-Type: application/json`, max 100 kB. The one exception is the multipart upload endpoint. |
| Success | `{ "data": …, "meta"?: { … } }` |
| No-content operations | `{ "data": { "ok": true } }` with status 200 (202 for accepted async work such as password-reset email) |
| Creates | `201 Created` |
| Money | Responses use **integer minor units** (`priceMinor: 109900` = ₹1,099.00) plus `currency`. Request money fields (`price`, `mrp`, `discountValue` for amounts, plan `price`) take **major units** as a string or number (`"1099"`, `"1,099.50"`). |
| Dates | ISO-8601 UTC strings. |
| Ids | UUIDs. A malformed id in a path returns `404 NOT_FOUND`. |
| Location | `lat`, `lng` (WGS84) and an optional `radiusKm` (1–200, default 10). Send both `lat` and `lng`, or neither. `0,0` counts as "no location". |
| Caching | Every response has `Cache-Control: no-store`. Price and stock are live data. |
| Tracing | Every response has an `x-request-id` header. You can also send your own. The same id appears in error bodies. |

### Pagination

Paginated endpoints take `page` (from 1) and `pageSize`, and return `meta: { page, pageSize, total }`:

| Endpoint | pageSize max | Notes |
| --- | --- | --- |
| `GET /search` | 50 (page ≤ 50) | `meta` also has `matchMode`, `hasLocation`, `radiusKm`, `existsOutsideRadius`, `tookMs` |
| `GET /merchant/shops/{shopId}/listings` | 100 | |
| `GET /admin/users`, `/admin/shops`, `/admin/catalog` | 100 | |
| `GET /admin/reports` | 100 | No `total` |

Other lists are capped rather than paginated: enquiries (100), shop reviews (50), notifications (`limit` ≤ 100), my reviews (100), `GET /shops` and `GET /offers` (`limit` ≤ 50).

## Authentication

Sessions are opaque random tokens. Only the SHA-256 hash is stored server-side. They last `SESSION_TTL_DAYS` (default **30 days**, see `src/lib/env.ts`) from sign-in, and `expiresAt` is returned.

| Client | How to authenticate |
| --- | --- |
| Mobile / scripts | `POST /auth/login` (or `/auth/register`) with `"client": "mobile"` (the API default). The response is `{ data: { token, expiresAt, user } }`. Send `Authorization: Bearer <token>` on every request. |
| Web (browser) | `"client": "web"`. The server sets the `locafy_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`) and does **not** return the token. A web login must come from the app's own origin. |

Session lifecycle:

- `POST /auth/logout` revokes the current session (token or cookie) and clears the cookie.
- `POST /me/password` revokes **all** of the user's sessions, then issues a fresh one for the caller: a new bearer token for bearer clients, a new cookie for cookie clients. Other devices must sign in again.
- `POST /auth/password-reset/confirm` revokes all sessions.
- A suspended (or deleted) user's tokens stop working at once and return `401`. Login returns `403 FORBIDDEN` with a suspension message. Suspension also deletes the user's sessions.
- An expired or revoked token returns `401 UNAUTHENTICATED`. Send the user to sign in again. There are no refresh tokens in v1.

### CSRF

State-changing requests (`POST/PUT/PATCH/DELETE`) that are **cookie-authenticated** must carry an `Origin` (or `Referer`) header that matches the app's origin (or `APP_URL`). Otherwise they get `403 FORBIDDEN` "Cross-site request blocked." Bearer-token requests are exempt, because browsers never attach bearer tokens automatically. Web logins/registrations (`client: "web"`) are origin-checked too, to prevent login CSRF.

## Errors

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Please check the highlighted fields.",
             "fieldErrors": { "email": ["Enter a valid email address."] },
             "details": { … }, "requestId": "…" } }
```

`message` is always safe to show to users. `fieldErrors` keys are field paths (`stock.0.price`). `_form` holds form-level errors.

| code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Bad input; see `fieldErrors` |
| `UNAUTHENTICATED` | 401 | Missing, expired or revoked session |
| `LIMIT_EXCEEDED` | 402 | Plan limit or feature not included; `details.limit`/`details.max` or `details.feature` |
| `FORBIDDEN` | 403 | Signed in but not allowed (role, cross-site, suspended login) |
| `NOT_FOUND` | 404 | Doesn't exist **or you are not allowed to know it exists** (e.g. another merchant's shop, listing, inventory, offer or enquiry) |
| `CONFLICT` | 409 | Duplicate, or stale `If-Match` version |
| `INVALID_STATE` | 409 | Not allowed in the current state (e.g. publishing an unapproved shop's offer) |
| `PAYLOAD_TOO_LARGE` | 413 | Body or upload too large |
| `UNSUPPORTED_MEDIA` | 415 | Not JPEG/PNG/WebP, or not multipart where it is required |
| `RATE_LIMITED` | 429 | `Retry-After` header and `details.retryAfterSeconds` |
| `SERVICE_UNAVAILABLE` | 503 | Dependency down (e.g. geocoder) |
| `INTERNAL_ERROR` | 500 | Unexpected error; it is logged with the `requestId` |

## Idempotency and concurrency

- **`POST /enquiries`**: send `Idempotency-Key: <unique string, max 64 chars>`. It is stored as the enquiry's `clientRequestId`. A retry with the same key from the same user returns the **original** enquiry (same `id`) instead of creating a duplicate. Generate one key per user action (for example a UUID created when the user taps Send) and reuse it for retries.
- **`PATCH /merchant/inventory/{inventoryId}`**: send `If-Match: "<version>"`, where version comes from `stock[].version` in `GET /merchant/listings/{id}` or from the previous response's `ETag`. If someone else changed the row in the meantime, the response is `409 CONFLICT` and nothing is written. On success the response's `ETag` holds the new version. You can send `expectedVersion` in the body instead; the header wins when both are present.
- `PUT /favourites` is naturally idempotent (it sets state, it doesn't toggle).
- `POST /reports` merges repeats into your open report on the same target. It returns 201 for a new report and 200 with `duplicate: true` for a repeat.

## Rate limits

These are fixed windows stored in Postgres (`RATE_RULES` in `src/modules/platform/rate-limit.ts`). Exceeding one returns `429` with `Retry-After`.

| Rule | Limit | Window | Keyed by | Applies to |
| --- | --- | --- | --- | --- |
| login | 10 | 15 min | IP + email | `POST /auth/login` (and the re-login inside `POST /me/password`) |
| register | 5 | 1 h | IP | `POST /auth/register` |
| passwordReset | 5 | 1 h | IP | `POST /auth/password-reset/request` |
| enquiryCreate | 10 | 1 h | user | `POST /enquiries` (retries count too) |
| enquiryMessage | 60 | 1 h | user | `POST /enquiries/{id}/messages` |
| reviewWrite | 10 | 1 h | user | `POST /reviews` |
| reportCreate | 20 | 1 h | user | `POST /reports` |
| upload | 60 | 1 h | user | `POST /merchant/shops/{shopId}/media` |
| geocode | 30 | 1 min | IP | `GET /locations/search` |
| search | 120 | 1 min | IP | `GET /search` |
| event | 300 | 1 min | IP | `POST /events` |

## Uploads

`POST /merchant/shops/{shopId}/media` takes `multipart/form-data` with these fields:

| field | required | value |
| --- | --- | --- |
| `file` | yes | JPEG, PNG or WebP, **≤ 5 MB** (`MAX_UPLOAD_BYTES`). The type is detected from magic bytes; the client MIME type is ignored. |
| `purpose` | yes | `logo` (sets the shop logo, cropped to 512×512), `cover` (sets the cover), or `listing` (adds a listing photo) |
| `listingId` | for `listing` | The listing must belong to this shop. Max 8 photos per listing. |

Images are auto-rotated, resized to fit 1600×1600 (logos 512×512) and re-encoded as WebP (quality 82). All metadata, including GPS EXIF, is stripped. Uploads count toward the plan's `maxStorageMb`. The response is `201 { data: { id, url, mimeType, bytes, width, height, purpose } }`. Requires the `media.upload` permission (owner/manager).

## Permissions

Merchant endpoints enforce the shop permission matrix (`SHOP_PERMISSIONS` in `src/modules/access/permissions.ts`):

| Permission | Roles |
| --- | --- |
| `shop.view` | owner, manager, staff |
| `shop.edit` | owner, manager |
| `shop.submit`, `shop.members`, `subscription.view` | owner |
| `listing.manage`, `offer.manage`, `review.respond`, `analytics.view`, `media.upload` | owner, manager |
| `inventory.update`, `enquiry.respond` | owner, manager, staff |

Callers who aren't members of a shop get `404` (not `403`). Members whose role lacks the permission get `403`. Platform admins have no implicit merchant rights; admin endpoints live under `/admin`.

## Endpoint reference

Auth column: **public**, **user** (any signed-in account), **member:<permission>**, **admin**, **super admin**. Paths are relative to `/api/v1`.

### Auth and account

| Method | Path | Auth | Body / query | Response `data` |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | public | `{ name, email, password (≥10, letter+digit), phone?, client?: "mobile"\|"web" }` | 201 mobile: `{ token, expiresAt, user{id,email,name} }`; web: `{ user, expiresAt }` + cookie |
| POST | `/auth/login` | public | `{ email, password, client? }` | mobile: `{ token, expiresAt, user{id,email,name,platformRole} }`; web: `{ user, expiresAt }` + cookie |
| POST | `/auth/logout` | any | – | `{ ok }`; revokes the session, clears the cookie |
| POST | `/auth/password-reset/request` | public | `{ email }` | 202 `{ ok }` (always, to avoid enumeration) |
| POST | `/auth/password-reset/confirm` | public | `{ token, password }` | `{ ok }`; revokes all sessions |
| GET | `/me` | user | – | `{ id, email, name, phone, platformRole, status, emailVerifiedAt, deletionRequestedAt, createdAt }` |
| PATCH | `/me` | user | `{ name, phone? }` (name required; omitting phone clears it) | updated `/me` |
| POST | `/me/password` | user | `{ currentPassword, newPassword }` | new session (same shape as login for the caller's client) |
| POST | `/me/deletion-request` | user | – | 202 `{ ok }`. An administrator completes the deletion. |
| DELETE | `/me/deletion-request` | user | – | `{ ok }` |
| GET | `/me/reviews` | user | – | your reviews (any status), with shop/product names |

### Discovery (public; a session adds `viewer` info)

| Method | Path | Auth | Body / query | Response |
| --- | --- | --- | --- | --- |
| GET | `/search` | public | `q, lat, lng, radiusKm, category (slug), brand (slug), minPrice, maxPrice (major units), availability=any\|in_stock, offers=true, minRating 1-5, sort=relevance\|price\|distance\|rating, page, pageSize` | `data: { query, items[], sponsored\|null, alternatives[] }`, `meta: { page, pageSize, total, matchMode: exact\|partial\|fuzzy\|browse, hasLocation, radiusKm, existsOutsideRadius, tookMs }`. `sponsored` is at most one and must be labelled "Sponsored". `alternatives` appear only when there are no matches and are **not** exact matches. |
| GET | `/search/suggest` | public | `q` | `{ products[], categories[] }` (existing route) |
| GET | `/products/{slug}` | public | `lat, lng` | `{ product, images[], sellers[], variants[], rating{average,count}, reviews[], viewer{saved,myReview}\|null }`. Sellers include price, offer, stock status, `stockUpdatedAt`, distance and contact. **Merged products** return **308** with `Location: /api/v1/products/{canonical}` and body `{ data: { redirectTo } }`. Most HTTP clients follow it automatically; update any stored slug. |
| GET | `/shops` | public | `lat, lng, radiusKm, q, category (slug), limit ≤50` | `NearbyShop[]` (nearest first), `meta: { hasLocation, radiusKm, total }` |
| GET | `/shops/{slug}` | public | `lat, lng` | `{ shop (incl. branches[], public contact), catalogue[] (≤60), offers[], reviews{average,count,items[]}, viewer }`. Records a shop view. |
| GET | `/offers` | public | `lat, lng, radiusKm (default 10), limit ≤50` | running offers with shop and products |
| GET | `/categories` | public | `scope=product\|shop` | `[{ id, slug, name, parentId, icon, scope, sortOrder }]` |
| GET | `/home` | public | `lat, lng, radiusKm` | `{ nearbyProducts[], popularProducts[], offers[], shops[] }`. Sections may be empty; nothing is padded. |
| GET | `/locations/search` | public | `q` | places (existing route) |
| GET | `/locations/reverse` | public | `lat, lng` | `{ label }` (existing route) |
| POST | `/events` | public | `{ type: contact_click\|direction_request\|offer_view, shopId, listingId?, offerId? }` | 202 `{ ok }` |

### Customer

| Method | Path | Auth | Body / query | Response |
| --- | --- | --- | --- | --- |
| GET | `/favourites` | user | – | `{ products[], shops[], hiddenShops }` |
| PUT | `/favourites` | user | `{ kind: product\|shop, id, saved: boolean }` | `{ saved }` |
| GET | `/enquiries` | user | – | your enquiries (as customer), latest activity first |
| POST | `/enquiries` | user | `{ shopId, listingId?, quantity? (1-10000), message (5-1000) }` + header `Idempotency-Key` | 201 enquiry |
| GET | `/enquiries/{id}` | customer or shop member (`enquiry.respond`) | – | `{ enquiry, viewerRole, shopName, shopSlug, customerName (first name + initial), product, messages[] }` |
| POST | `/enquiries/{id}/messages` | customer or shop member | `{ body (1-2000) }` | 201 `{ ok }` |
| POST | `/enquiries/{id}/close` | customer or shop member | – | `{ ok }` |
| POST | `/enquiries/{id}/reopen` | customer or shop member | – | `{ ok }` |
| POST | `/reviews` | user | `{ targetType: shop\|product, targetId, rating 1-5, body? (10-2000 or empty) }` | 201 `{ id, created: true }` or 200 `{ id, created: false }` (edit, within 30 days) |
| DELETE | `/reviews/{id}` | author | – | `{ ok }` |
| POST | `/reports` | user | `{ targetType: shop\|listing\|product\|review\|offer\|enquiry, targetId, reason: incorrect_info\|out_of_stock\|closed\|prohibited\|offensive\|spam\|duplicate\|other, details? }` | 201 `{ id, duplicate: false }` / 200 `{ id, duplicate: true }` |
| GET | `/notifications` | user | `limit ≤100` | `[{ id, type, title, body, link, readAt, createdAt }]`, `meta: { unreadCount }` |
| POST | `/notifications/read-all` | user | – | `{ ok }` |
| GET | `/notifications/preferences` | user | – | `{ emailEnquiries, emailReviews, emailShopStatus, emailMarketing }` |
| PUT | `/notifications/preferences` | user | any subset of those booleans | merged preferences |

Notification `link` values are web paths (for example `/account/enquiries/{id}`). Mobile clients should map them to screens.

### Merchant

| Method | Path | Auth | Body / query | Response |
| --- | --- | --- | --- | --- |
| GET | `/merchant/shops` | user | – | `[{ id, name, slug, status, logoUrl, role, onboardingStep }]` |
| POST | `/merchant/shops` | user (max 3 owned) | `{ name, categoryId, description? }` | 201 `{ id, slug, name, status: "draft", onboardingStep }` |
| GET | `/merchant/shops/{shopId}` | member:shop.view | – | `{ shop (no verificationNote; hasVerificationNote), role, branches[], onboardingGaps[] }` |
| PATCH | `/merchant/shops/{shopId}` | member:shop.edit | `{ name, categoryId, description? }` | same as GET |
| PUT | `/merchant/shops/{shopId}/contact` | member:shop.edit | `{ phone, whatsapp?, email?, website?, openingHours?: { mon: [{open:"09:00",close:"18:00"}], … } }` | `{ ok }` |
| PUT | `/merchant/shops/{shopId}/primary-branch` | member:shop.edit | `{ addressLine, city, lat, lng, name?, locality?, region?, postalCode?, phone? }` | `{ ok }` |
| POST | `/merchant/shops/{shopId}/branches` | member:shop.edit (plan `maxBranches`) | same as primary-branch | 201 `{ id }` |
| POST | `/merchant/shops/{shopId}/submit` | member:shop.submit | `{ verificationNote }` | `{ ok }` (status → pending) |
| GET | `/merchant/shops/{shopId}/members` | member:shop.view | – | `[{ userId, name, email, role, since }]` |
| POST | `/merchant/shops/{shopId}/members` | member:shop.members (plan `maxStaff`) | `{ email, role: manager\|staff }` | 201 `{ ok }` |
| DELETE | `/merchant/shops/{shopId}/members/{userId}` | member:shop.members | – | `{ ok }` (owners can't be removed) |
| GET | `/merchant/shops/{shopId}/listings` | member:shop.view | `q, status (draft\|published\|unpublished\|archived\|discontinued\|restricted\|active), stock (in_stock\|low_stock\|out_of_stock\|unknown\|stale), sort=updated\|name\|price, page, pageSize` | paginated listing summaries |
| POST | `/merchant/shops/{shopId}/listings` | member:listing.manage (plan `maxListings`) | `{ catalogProductId \| product{ name, categoryId, brand?, model?, variant?, description?, specs?, aliases?, gtin? }, notes?, stock: [{ branchId, price, mrp?, quantity?, stockStatus?, lowStockThreshold? }], publish? }` | 201 `{ id, catalogProductId }` |
| GET | `/merchant/listings/{listingId}` | member:shop.view | – | `{ listing, role, product, stock[] (with id, version), images[], history[], branches[], editableCatalog }` |
| PATCH | `/merchant/listings/{listingId}` | member:listing.manage | `{ notes?, product? }` | same as GET |
| POST | `/merchant/listings/{listingId}/status` | member:listing.manage | `{ action: publish\|unpublish\|archive\|discontinue\|restore }` | `{ id, status }` |
| POST | `/merchant/listings/{listingId}/stock` | member:listing.manage | `{ branchId, price, quantity?, stockStatus? }` | 201 `{ id }` (new inventory row) |
| DELETE | `/merchant/listings/{listingId}/images/{imageId}` | member:listing.manage | – | `{ ok }` |
| PATCH | `/merchant/inventory/{inventoryId}` | member:inventory.update | `{ price?, mrp? (null clears), quantity? \| adjust?, untrackQuantity?, stockStatus?, lowStockThreshold?, confirm? }` + `If-Match` | `{ inventory, changed }`, `ETag` = new version |
| GET | `/merchant/shops/{shopId}/offers` | member:shop.view | – | offers with `listingCount`, `phase` |
| POST | `/merchant/shops/{shopId}/offers` | member:offer.manage | `{ title, description?, conditions?, discountType: percent\|amount_off\|fixed_price, discountValue, startsAt, endsAt, listingIds[], publish? }` | 201 offer |
| GET | `/merchant/shops/{shopId}/offerable-listings` | member:offer.manage | – | `[{ id, name, variant, status }]` |
| GET | `/merchant/offers/{offerId}` | member:offer.manage | – | offer + `listingIds`, `phase` |
| PUT | `/merchant/offers/{offerId}` | member:offer.manage | full offer body (as create, without `publish`) | updated offer |
| POST | `/merchant/offers/{offerId}/publish` | member:offer.manage (plan `maxActiveOffers`) | – | offer |
| POST | `/merchant/offers/{offerId}/unpublish` | member:offer.manage | – | offer |
| GET | `/merchant/shops/{shopId}/enquiries` | member:enquiry.respond | `status=open\|responded\|closed` | enquiry summaries. Use `/enquiries/{id}…` to read, reply, close or reopen. |
| GET | `/merchant/shops/{shopId}/reviews` | member:review.respond | – | reviews incl. hidden, `meta: { average, count }` |
| POST | `/merchant/reviews/{reviewId}/response` | member:review.respond | `{ response (2-1000) }` | `{ ok }` |
| GET | `/merchant/shops/{shopId}/analytics` | member:analytics.view | `days=7\|30\|90` | `{ days, byType{type:{total,unique}}, daily[{day,views,actions}], topProducts[] }` |
| GET | `/merchant/shops/{shopId}/subscription` | member:subscription.view | – | `{ plan, subscription, entitlements, usage[{key,label,used,max}] }` (`max: -1` = unlimited) |
| POST | `/merchant/shops/{shopId}/media` | member:media.upload | multipart (see Uploads) | 201 media asset |

### Admin

These are for automation. The admin UI itself uses server actions. Every call is audited by the services.

| Method | Path | Auth | Body / query | Response |
| --- | --- | --- | --- | --- |
| GET | `/admin/overview` | admin | – | platform counters |
| GET | `/admin/shops` | admin | `q, status, page, pageSize` | paginated shops |
| GET | `/admin/shops/{shopId}` | admin | – | `{ shop (incl. verificationNote), members (with emails), branches, category, plan, history, duplicates }` |
| POST | `/admin/shops/{shopId}/decision` | admin | `{ decision: approve\|reject\|suspend\|reactivate, reason? (required for reject/suspend) }` | `{ ok }` |
| POST | `/admin/shops/{shopId}/plan` | admin | `{ planId, periodDays? }` | `{ ok }` |
| GET | `/admin/users` | admin | `q, status=active\|suspended\|deleted\|deletion_requested, page, pageSize` | paginated users (with emails) |
| GET | `/admin/users/{userId}` | admin | – | `{ user (no password hash), memberships, history }` |
| POST | `/admin/users/{userId}/suspend` | admin (super admin for admins) | `{ reason }` | `{ ok }`; revokes the user's sessions |
| POST | `/admin/users/{userId}/reactivate` | admin | – | `{ ok }` |
| GET | `/admin/reports` | admin | `status=open\|actioned\|dismissed, page, pageSize` | reports with target labels |
| POST | `/admin/reports/{reportId}/resolve` | admin | `{ outcome: actioned\|dismissed, note }` | `{ ok }` |
| GET | `/admin/reviews` | admin | `status=published\|hidden\|removed` | reviews for moderation (≤100) |
| POST | `/admin/reviews/{reviewId}/status` | admin | `{ status: published\|hidden\|removed, reason? (required unless published) }` | `{ ok }` |
| GET | `/admin/catalog` | admin | `q, status=active\|restricted\|merged, page, pageSize` | paginated catalogue |
| POST | `/admin/catalog/{productId}/restriction` | admin | `{ restricted: boolean, reason? (required when restricting) }` | `{ ok }` |
| POST | `/admin/catalog/merge` | admin | `{ sourceId, targetId }` | `{ ok }`. The source becomes a 308 redirect on `/products/{slug}`. |
| GET | `/admin/plans` | admin | – | plans with `subscribers` |
| POST | `/admin/plans` | super admin | `{ code, name, description?, price, interval: month\|year, sortOrder, isActive, maxListings, maxStorageMb, maxBranches, maxStaff, maxActiveOffers (-1 = unlimited), advancedAnalytics, bulkImport, promotionScheduling, sponsoredPlacements }` | 201 `{ ok }` |
| PUT | `/admin/plans/{planId}` | super admin | same as create | `{ ok }` |

## Data exposure rules

- Password hashes and session tokens are never returned. The one exception is the bearer token in the mobile login, register and password-change responses.
- Shop verification notes appear only on admin endpoints. Merchants get `hasVerificationNote`.
- Customers' names are shown to merchants and the public as first name + initial (for example "Priya M."). Customer emails are never shown to merchants.
- Shop team member emails are visible to members of that shop only.
- Stock status is **as last reported by the shop**. Always display `stockUpdatedAt` next to it.

## Not in v1 (yet)

- Refresh tokens and a "list my sessions / sign out other devices" endpoint
- Push-notification device registration
- Deleting offers (unpublish instead)
- Bulk inventory import
- Webhooks
- Email verification
