# Mobile integration strategy

Native Android and iOS apps talk to the same backend as the web app, through the versioned JSON API documented in [`docs/api.md`](./api.md). There is no separate mobile backend. Every `/api/v1` route is a thin wrapper over the application services in `src/modules/*`, the same services that power the web UI's server components and server actions. So:

- business rules, permissions, plan limits, rate limits and audit logging are identical on web and mobile;
- a fix or rule change in a service applies to both clients at once;
- new mobile features start by adding (or reusing) a service function, then exposing it as a v1 route.

## Versioning contract

- Pin the client to `/api/v1`. Within v1 the server only makes **additive** changes. Clients must ignore unknown fields and handle unknown enum values gracefully (generic label or icon).
- Breaking changes go to `/api/v2`. Old app versions keep working against v1 during the deprecation period, so forced upgrades should be rare.
- Send an `x-request-id` (UUID) per request if you want to correlate client logs with server logs. Error bodies echo it as `error.requestId`.

## Authentication and token storage

1. Sign in with `POST /api/v1/auth/login` `{ email, password, client: "mobile" }`, or register with `/auth/register`. The response is `{ data: { token, expiresAt, user } }`.
2. Send `Authorization: Bearer <token>` on every request. Bearer requests are exempt from the browser CSRF origin check.
3. Store the token **only** in platform secure storage:
   - **iOS**: Keychain, `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` (no iCloud sync, no backup migration).
   - **Android**: Android Keystore-backed encryption (e.g. `EncryptedSharedPreferences` / Jetpack Security, or a Keystore AES key wrapping the token in DataStore). Exclude it from Auto Backup.
   - Never put it in plain `UserDefaults`/`SharedPreferences`, logs, crash reports, analytics or URLs.
4. Tokens last `SESSION_TTL_DAYS` (default 30) from sign-in. There is no refresh token in v1. On any `401 UNAUTHENTICATED`, clear the stored token and show sign-in. A token stops working when:
   - it expires;
   - the user signs out (`POST /auth/logout` revokes it on the server; always call it before deleting the local copy);
   - the password is changed or reset (all sessions are revoked). After `POST /me/password` the response contains a **new** token, so replace the stored one;
   - the account is suspended or deleted.
5. A suspended account's login returns `403 FORBIDDEN` with a user-facing message. Show it as-is.

## Location handling

- Ask for location permission only when the user first needs nearby results (search, home, map), and explain why. "While using the app" / coarse location is enough. Background location is never needed.
- Always offer a manual alternative: `GET /api/v1/locations/search?q=` (towns, localities, landmarks, postal codes) and `GET /api/v1/locations/reverse?lat=&lng=` for a display label.
- Pass the chosen point as `lat`/`lng` (and optionally `radiusKm`, 1–200, default 10) to `/search`, `/home`, `/shops`, `/shops/{slug}`, `/offers` and `/products/{slug}`. Without a point, results are not distance-sorted and `meta.hasLocation` is `false`. Say so in the UI rather than implying proximity.
- Round coordinates to about 4 decimals (~10 m) before sending. More precision is not needed, and rounding improves privacy.
- When `meta.existsOutsideRadius` is true and there are no items, suggest widening the radius. `alternatives` are similar products, not exact matches, so label them that way.
- Directions: open the platform maps app with the branch `lat`/`lng`, then `POST /api/v1/events` `{ type: "direction_request", shopId, listingId? }`. For call or WhatsApp taps, send `contact_click`. These feed merchant analytics. A direction request is not a confirmed visit.

## Image upload (merchant app)

- `POST /api/v1/merchant/shops/{shopId}/media` as `multipart/form-data` with `file`, `purpose` (`logo` | `cover` | `listing`) and `listingId` for listing photos.
- Limits: JPEG, PNG or WebP only (checked by file signature), **≤ 5 MB**, max 8 photos per listing, and uploads count toward the plan's storage quota (`402 LIMIT_EXCEEDED`).
- Before uploading, downscale on the device to about 1600 px on the long edge and compress (JPEG ~80%). Uploads get faster and fewer hit the 5 MB limit. The server re-encodes to WebP anyway.
- The server strips all metadata, including GPS EXIF, so you don't need to strip it yourself. It is still good practice not to request "precise location in photos" permissions.
- Use a background upload task (URLSession background / WorkManager) with retry. Uploading the same image twice creates two assets, so only retry on network failure, never on a 4xx response.

## Offline use and caching

- **Never present cached stock or price as current.** Show stock status with its `stockUpdatedAt` ("Updated 2 h ago"). When you show cached data offline, mark it clearly as offline or last-synced data. Never cache "in stock" across sessions.
- Responses are `Cache-Control: no-store`. Don't put an HTTP cache in front of the API. Any client-side cache is an explicit, short-lived view cache you manage yourself.
- Safe to cache for a while: categories (`/categories`, ~1 day), the user's own profile (`/me`), favourites (as a list of ids to render hearts; refresh on app start), and notification preferences.
- Search results, product detail sellers, offers and shop catalogues should be refreshed whenever a screen opens. Keep at most the last result in memory for back navigation.
- Queue writes made while offline only where they are idempotent:
  - enquiries: generate an `Idempotency-Key` when the user taps Send and reuse it for every retry;
  - favourites: `PUT /favourites` sets absolute state;
  - inventory edits (merchant): send `If-Match` with the version you read. A `409 CONFLICT` means someone else changed it, so re-fetch and let the user decide. Never auto-overwrite.
- Respect `429` `Retry-After` and use exponential backoff for `5xx` responses.

## Notifications

- In-app notifications already exist: `GET /api/v1/notifications` (with `meta.unreadCount`), `POST /notifications/read-all`, and email preferences at `/notifications/preferences`. Poll on app foreground or pull-to-refresh, for example to show a badge.
- Notification `link` values are web paths (`/account/enquiries/{id}`, `/merchant/{shopId}/enquiries/{id}`, …). Map known prefixes to native screens and fall back to opening the web URL.
- **Push notifications are a planned addition**, not part of v1. The `notifications` table and the `notify()` service are the single place where notifications are created, so push can be added there: register device tokens (APNs/FCM) through a new `POST /api/v1/me/devices` endpoint, then fan out after commit alongside the existing email delivery. No client changes to existing endpoints will be needed.

## Accessibility and UX parity

Mirror the web rules: status is never conveyed by colour alone, sponsored results are always labelled, prices come from minor units with the given `currency`, and empty sections are shown as empty states rather than filled with invented content.

## Not yet provided

- Refresh tokens, a device/session list, and "sign out other devices"
- Push notification device registration and delivery
- Social / OTP / passkey sign-in (email + password only), and email verification
- Account deletion is a request (`POST /me/deletion-request`) that an administrator completes; there is no instant self-service delete
- Offline sync APIs (delta or `since=` endpoints) and ETags on read endpoints, other than the inventory `ETag`/`If-Match`
- Bulk inventory import, barcode lookup, and offer deletion
- In-app payments or subscription purchase (plans are assigned by administrators)
