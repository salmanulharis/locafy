# Security

| Area | Implementation |
|---|---|
| Passwords | argon2id (m=19 MiB, t=2); min 10 chars with letter + digit; constant-cost check for unknown emails |
| Sessions | 256-bit random tokens, stored hashed (SHA-256); httpOnly, SameSite=Lax, Secure in production; bearer tokens for mobile; revoked on logout, password change/reset, suspension, role change, deletion |
| CSRF | Server Actions: Next.js built-in origin check. API: cookie-authenticated writes require matching `Origin`/`Referer`; bearer requests exempt |
| Authorisation | Services only: `requireUser`, `requireAdmin`, `requireSuperAdmin`, `requireShopPermission` with one permission matrix. Non-members get 404. Admin UI hidden **and** server-enforced |
| Role boundaries | Shop owners cannot change platform roles; only super admins change roles/plans; admins cannot act on themselves; plain admins cannot act on other admins |
| Validation | Zod on every service input; DB CHECK constraints as a second line (prices, quantities, ratings, offer windows) |
| Output | React escaping; map popups escape HTML; no `dangerouslySetInnerHTML` |
| Rate limits | Postgres fixed windows for login, register, reset, enquiries, messages, reviews, reports, uploads, geocoding, search, events (`RATE_RULES`) |
| Abuse | Enquiry honeypot + link/repetition heuristic; idempotency keys; reports and moderation queue |
| Uploads | 5 MB limit, magic-byte sniffing, sharp re-encode to WebP (strips EXIF/GPS), pixel limit, server-generated keys, path-traversal guard, storage quota per plan |
| Secrets | Server-only env (`src/lib/env.ts`); only `NEXT_PUBLIC_MAP_STYLE_URL` reaches the browser; `.env` git-ignored |
| Headers | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; `poweredByHeader` off |
| Audit | `audit_logs` for sensitive actions (approvals, moderation, role/plan changes, password events, listing status); `moderation_actions` history |
| Privacy | Public names shown as "First L."; merchants never see customer email/phone; visitor analytics use a daily-rotating hash, not IPs; account deletion anonymises PII |
| Errors | User-safe messages; internals logged to `error_logs` with request id |

## Before production

- Add HTTPS, HSTS and a Content-Security-Policy at the edge (CSP needs the map tile origins).
- Configure a real mail provider (password reset depends on it) and add email verification.
- Consider MFA for admin accounts.
- Run a dependency audit (`pnpm audit`) and a penetration test of `/api/v1`.
