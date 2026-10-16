# Locafy design system — Blue + Slate

Modern, minimal and trustworthy: mostly white and near-white surfaces, slate text, subtle borders, blue for actions and selection, amber only for offers.

## Source of truth

| File | Role |
|---|---|
| `src/design/tokens.json` | **Platform-independent** palette + semantic tokens (with intended use). Native Android/iOS apps should import or mirror this file. |
| `src/app/globals.css` (`:root`) | Web CSS variables, one per semantic token, mapped to Tailwind utilities in `@theme inline`. |
| `src/lib/brand.ts` | Hex values for places that can't read CSS variables (map markers, manifest, `theme-color`), derived from `tokens.json`. |
| `scripts/generate-icons.mjs` | Regenerates app icons from `tokens.json` (`pnpm icons`). |
| `tests/unit/design-tokens.test.ts` | Fails if CSS and JSON drift apart, if brand values change unintentionally, or if any text pair in use drops below WCAG AA. |

To change a colour: edit `tokens.json` and the matching line in `globals.css`, run `pnpm test:unit` and `pnpm icons`.

## Palette

| Name | Hex | Used for |
|---|---|---|
| Primary Blue | `#2563EB` | Primary buttons, links, active navigation, selected controls, focus ring |
| Primary Blue Hover | `#1D4ED8` | Hover / pressed / active states; text on light blue |
| Deep Navy | `#0F172A` | Headings, prices, prominent text, text on amber |
| Body Text | `#334155` | Standard text and descriptions |
| Secondary Slate | `#64748B` | Metadata, timestamps, supporting text, placeholders |
| Page Background | `#F8FAFC` | App background |
| Surface White | `#FFFFFF` | Cards, forms, dropdowns, modals, panels |
| Borders | `#E2E8F0` | Card outlines, dividers, table separators |
| Light Blue | `#EFF6FF` | Selected navigation, highlights, info backgrounds, home hero panel |
| Amber Accent | `#F59E0B` | Discounts and offer badges only |
| Success Green | `#15803D` | Success, verified, in stock |
| Warning Amber | `#B45309` | Warnings, low stock, needs attention; offer text |
| Error Red | `#B91C1C` | Validation errors, failures, destructive actions |

Derived tints of the same hues (functional, not extra brand colours): `#F1F5F9` subtle fill, `#CBD5E1` form-control outline, `#94A3B8` decorative icons only, `#F0FDF4` / `#FFFBEB` / `#FEF2F2` status backgrounds, `#991B1B` destructive hover.

## Semantic tokens (Tailwind utility → token)

| Utility | Token | Rule |
|---|---|---|
| `bg-bg` / `bg-surface` / `bg-surface-2` | `--bg` / `--surface` / `--surface-2` | Use `text-fg` (not `text-muted`) on `surface-2` |
| `text-strong` | `--fg-strong` | Headings get it automatically (base style); use for prices and key figures |
| `text-fg` / `text-muted` | `--fg` / `--fg-muted` | Muted only on `bg` or `surface` |
| `text-subtle` | `--fg-subtle` | Decorative icons only — never text or meaningful icons |
| `border-border` / `border-border-strong` | `--border` / `--border-strong` | Strong for inputs/selects |
| `bg-primary text-primary-fg`, `hover:bg-primary-hover` | primary | Buttons; links use `text-primary` |
| `bg-primary-soft text-primary-soft-fg` | primary-soft | Selected nav items, highlights, info |
| `bg-accent text-accent-fg` (`Badge tone="deal"`) | accent | Offers only; never white text on amber |
| `*-success-*`, `*-warning-*`, `*-danger-*`, `*-info-*` | status | Always pair with text and/or an icon |
| `outline-ring` | `--ring` | Global `:focus-visible` outline (2px) |

## Verified contrast (WCAG 2.2 AA)

| Pair | Ratio |
|---|---|
| White on Primary `#2563EB` | 5.17 : 1 |
| White on Primary Hover | 6.70 : 1 |
| Primary link on white / on page background | 5.17 / 4.94 : 1 |
| `#1D4ED8` on Light Blue | 6.16 : 1 |
| Navy on page background | 17.06 : 1 |
| Body text on white / on `#F1F5F9` | 10.35 / 9.45 : 1 |
| Secondary slate on white / on page background | 4.76 / 4.55 : 1 |
| Navy on Amber (offer badge) | 8.31 : 1 |
| Warning amber on white / on amber tint | 5.02 / 4.84 : 1 |
| Success on white / on green tint | 5.02 / 4.79 : 1 |
| Error on white / on red tint; white on error | 6.47 / 5.91 / 6.47 : 1 |
| Focus ring on white (non-text, ≥ 3 : 1) | 5.17 : 1 |

Known limitation: form-control outlines (`#CBD5E1`, 1.5 : 1) and card borders are below the 3 : 1 non-text guideline — common practice for minimal UIs; controls are always labelled, and focus adds a blue border + ring. Switch `--border-strong` to `#64748B` if strict 1.4.11 conformance is required.

## Usage rules

- Blue is for actions, links, active and selected states — not decoration. Headers, sidebars and cards stay white.
- Amber is reserved for offers/discounts; don't use it as a second brand colour.
- Prefer subtle borders over shadows; shadows only for overlays (menus, dialogs, toasts) and hover lift.
- No gradients or colourful page backgrounds; the only tinted panel is the home hero (`bg-primary-soft`).
- Status always uses text and/or an icon in addition to colour.
- Radii: controls `rounded-lg`, cards `rounded-xl`, panels `rounded-2xl`. Control height 44 px (`h-11`).

## Native apps (future)

Map `semantic` keys from `tokens.json` 1:1 to platform themes (e.g. Jetpack Compose `ColorScheme`: `primary` → primary, `primary-fg` → onPrimary, `surface` → surface, `fg` → onSurface, `fg-muted` → onSurfaceVariant, `border` → outlineVariant, `danger` → error; SwiftUI asset-catalog colours with the same names). Keep the semantic names identical across platforms so designs and code reviews share one vocabulary.

## Dark theme

A slate-based dark token set exists under `:root[data-theme="dark"]` but is **not enabled**. Review contrast for every pair before turning it on.
