# External integrations — status and setup

| Integration | Status | Boundary | To enable |
|---|---|---|---|
| Map tiles | **Working** (OpenFreeMap, no key) | `NEXT_PUBLIC_MAP_STYLE_URL`, `src/components/maps/*` | For an SLA, use MapTiler/Stadia/self-hosted tiles and set the style URL |
| Geocoding | **Working with fallback** | `src/modules/geo/locations.ts` | Built-in localities always work. Public Nominatim needs `GEOCODER_CONTACT_EMAIL` and ≤1 req/s; for production use a commercial or self-hosted Nominatim (`GEOCODER_URL`) |
| Directions | **Working** (external link) | `directionsUrl()` | — Locafy only links out; it never computes routes |
| Media storage | Local **working**; Supabase **implemented, unverified** | `src/modules/media/storage.ts` | Create a public bucket, set `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `STORAGE_PUBLIC_HOST=<project>.supabase.co`, then upload a test image |
| Email | **Not configured** (`log` driver prints mail to server logs) | `src/modules/notifications/mailer.ts` | Implement a driver (SMTP/SES/Resend…) in `sendMail`, add its env vars, schedule `deliverPendingEmails()` |
| Payments | **Not implemented** | Plans/entitlements in `src/modules/subscriptions`, `subscriptions.provider/provider_ref` | Add a provider (e.g. Razorpay/Stripe) with verified webhooks, idempotent event processing keyed by provider event id, and status mapping → `subscriptions.status`. Until then admins assign plans manually |
| Push notifications | **Not implemented** | `notifications` table | Add device token table + FCM/APNs sender (see `docs/mobile.md`) |
