# Locafy engineering conventions

Read this before adding code. It describes how the existing pieces fit together.

## Stack

- Next.js **16.4** App Router (Turbopack), React 19.3, TypeScript strict. **`cacheComponents` is disabled** — pages are dynamic; do not add `"use cache"`. Request APIs are async (`await params`, `await searchParams`, `await cookies()`). `middleware` is now `proxy`. Bundled docs: `node_modules/next/dist/docs/`.
- Tailwind CSS v4 with semantic tokens in `src/app/globals.css`, mirrored from `src/design/tokens.json` (see `docs/design-system.md`). Font-size scale: `text-display`, `text-title`, `text-heading`, `text-price`. **Never hard-code hex colours in components.**
- PostgreSQL 17 + PostGIS via Drizzle ORM (`src/db/schema.ts`, `src/db/client.ts → getDb()`).
- Zod 4 for validation (`z.partialRecord` for optional enum-keyed records).
- Icons: `lucide-react`.

## Layers (do not skip)

```
src/app/**            routes: pages, server actions, /api/v1 route handlers  (thin)
src/components/**     presentation only (no DB access)
src/modules/<domain>/ application services + pure rules  (all business logic & authz)
src/lib/**            cross-cutting helpers (errors, http, actions, validation, money)
src/db/**             schema + connection
```

- **All business rules and permission checks live in `src/modules/*` services.** Pages, actions and API routes only parse transport input and call services.
- Every service takes a `Ctx` (`src/modules/auth/context.ts`) as its first argument. Get it with `await getCtx()` (server components/actions) or `getRequestCtx(req)` (route handlers; the `api()` wrapper does this).
- Authorisation helpers: `requireUser`, `requireAdmin`, `requireSuperAdmin`, `requireShopPermission(ctx, shopId, "listing.manage")` in `src/modules/access/permissions.ts`. The permission matrix (`SHOP_PERMISSIONS`) is the single source of truth. Non-members get `NOT_FOUND`.
- Validation: `parseInput(schema, input)` throws `AppError("VALIDATION_ERROR")` with `fieldErrors` keyed by field path.
- Errors: throw `errors.*` from `src/lib/errors.ts`. Messages must be user-safe.
- Limits: plan limits only via `assertWithinLimit` / `assertFeature` (`src/modules/subscriptions/entitlements.ts`).
- Sensitive changes: call `audit(tx, ctx, {...})` inside the same transaction.

## Server actions + forms

Pattern (see `src/app/(public)/(auth)/actions.ts`):

```ts
"use server";
export async function saveThing(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return runAction((ctx) => service.saveThing(ctx, id, formDataToObject(fd)), "Saved");
}
```

In a server component page: `<ActionForm action={saveThing.bind(null, id)}> <TextField name="title" label="Title" /> … <SubmitButton>Save</SubmitButton></ActionForm>` (`src/components/forms/*`). Field errors appear automatically by `name`. `ActionForm` calls `router.refresh()` on success (or `redirectTo`). Use `ConfirmAction` for destructive actions (optionally with a required `reason`). `formDataToObject` turns `name[]` keys into arrays and empty strings into `undefined`.

For JSON-shaped inputs (arrays of objects), parse in the action before calling the service.

## API (`/api/v1`)

```ts
export const GET = api(async ({ req, ctx, params }) => ok(await service.x(ctx, searchParamsObject(req))));
export const POST = api(async ({ req, ctx }) => ok(await service.y(ctx, await readJson(req)), undefined, { status: 201 }));
```

`api()` (`src/lib/http.ts`) resolves cookie **or** `Authorization: Bearer` sessions, blocks cross-origin cookie-authenticated writes, and maps `AppError` → `{ error: { code, message, fieldErrors?, requestId } }` with the right status. Success: `{ data, meta? }`. Never return raw DB rows that contain private columns (password hashes, verification notes, emails of other users).

## UI

- Mobile-first. Touch targets ≥ 44px (`h-11` controls, `size="md"` buttons). No hover-only actions. No horizontal page overflow; wide tables must become stacked lists on small screens (`hidden md:table` + card list) or live in an `overflow-x-auto` region with a clear label.
- Reuse: `Button`/`LinkButton`, `Card`, `Badge`, `Alert`, `EmptyState`, `Skeleton`, `PageHeader`, `StatTile` (`src/components/ui/*`), `Dialog` (native `<dialog>`, `variant="sheet"` for drawers), `Availability`, `Price`, `ProductImage`, `RatingSummary`/`Stars`, `ShopLogo`.
- Status must be conveyed with text and/or icon, never colour alone.
- Colours: Blue + Slate design system — read `docs/design-system.md`. Use semantic utilities only (`bg-primary`, `text-strong`, `text-muted`, `bg-primary-soft`, `Badge tone="deal"` …); never hard-code hex values (use `src/lib/brand.ts` where CSS variables cannot be read). `text-subtle` is for decorative icons only.
- Never show fabricated numbers; when there is no data, show an `EmptyState`.
- Dates: `relativeTime()` from `src/components/products/availability.tsx`, or `Intl.DateTimeFormat("en-IN", …)`.
- Money: integers in minor units; display with `formatMoney()`; form inputs in major units via `moneySchema` (accepts "1499.50").

## Testing

- Unit tests: pure rules (`src/modules/**/rules.ts`, `query.ts`, `identity.ts`, …) → `tests/unit/**`.
- Integration tests: services against `TEST_DATABASE_URL` → `tests/integration/**`.
- E2E: Playwright → `e2e/**`.
