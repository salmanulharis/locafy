import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export type TabItem = { label: string; href: string; active: boolean; count?: number };

/** Status tabs; they scroll inside their own region on narrow screens. */
export function FilterTabs({ items, label = "Filter" }: { items: TabItem[]; label?: string }) {
  return (
    <nav aria-label={label} className="mb-4 max-w-full overflow-x-auto">
      <ul className="flex w-max gap-1 rounded-xl bg-surface-2 p-1">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium whitespace-nowrap",
                t.active ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
              )}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className="rounded-full bg-warning-soft px-1.5 text-xs text-warning-soft-fg tabular">
                  {t.count}
                  <span className="sr-only"> items</span>
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** GET search form that preserves the other filters as hidden inputs. */
export function SearchForm({
  action,
  q,
  placeholder,
  hidden = {},
  name = "q",
  label = "Search",
}: {
  action: string;
  q?: string;
  placeholder: string;
  hidden?: Record<string, string | undefined>;
  name?: string;
  label?: string;
}) {
  return (
    <form action={action} method="get" role="search" className="mb-4 flex gap-2">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor={`admin-search-${name}`} className="sr-only">
        {label}
      </label>
      <Input id={`admin-search-${name}`} type="search" name={name} defaultValue={q} placeholder={placeholder} className="min-w-0 flex-1" />
      <button type="submit" className={buttonClass("outline", "md")} aria-label={label}>
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search</span>
      </button>
    </form>
  );
}

/** Build a URL with query params, dropping empty values. */
export function hrefWith(base: string, params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

export function Pagination({
  page,
  pageSize,
  total,
  hasNext,
  href,
}: {
  page: number;
  pageSize: number;
  total?: number;
  hasNext?: boolean;
  href: (page: number) => string;
}) {
  const pages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const next = pages != null ? page < pages : Boolean(hasNext);
  const summary = (
    <p className="text-sm text-muted">
      {pages != null && pages > 1 ? `Page ${page} of ${pages} · ` : page > 1 ? `Page ${page} · ` : ""}
      {total != null ? `${total} result${total === 1 ? "" : "s"}` : ""}
    </p>
  );
  if (page <= 1 && !next) return <div className="mt-4">{summary}</div>;
  const disabled = buttonClass("outline", "md", "pointer-events-none opacity-50");
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {summary}
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClass("outline", "md")} rel="prev">
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Link>
        ) : (
          <span className={disabled} aria-disabled>
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </span>
        )}
        {next ? (
          <Link href={href(page + 1)} className={buttonClass("outline", "md")} rel="next">
            Next <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span className={disabled} aria-disabled>
            Next <ChevronRight className="size-4" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}

/** Parse a positive page number from a search param. */
export function pageParam(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}

export function strParam(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim() : undefined;
}
