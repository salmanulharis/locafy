import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function NoAccess({ what }: { what: string }) {
  return (
    <Card>
      <EmptyState
        icon={<Lock className="size-5" />}
        title="Not available for your role"
        description={`Your role in this shop doesn't include ${what}. Ask the shop owner if you need access.`}
      />
    </Card>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-sm text-muted hover:text-fg">
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

/** Usage vs plan limit. `max < 0` means unlimited. */
export function UsageBar({ label, used, max, unit }: { label: string; used: number; max: number; unit?: string }) {
  const unlimited = max < 0;
  const pct = unlimited ? 0 : max === 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / max) * 100));
  const full = !unlimited && used >= max;
  const tone = full ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-medium first-letter:uppercase">{label}</span>
        <span className="tabular text-muted">
          {used}
          {unit ? ` ${unit}` : ""} of {unlimited ? "unlimited" : `${max}${unit ? ` ${unit}` : ""}`}
          {full && <span className="ml-1 font-medium text-danger-soft-fg">· limit reached</span>}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : max}
        aria-valuenow={used}
        aria-valuetext={unlimited ? `${used}, no limit` : `${used} of ${max}`}
      >
        {!unlimited && <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, hrefFor }: { page: number; pageSize: number; total: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClass("outline", "md")}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={buttonClass("outline", "md")}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Horizontal link tabs (filters, settings sections). Scrolls on narrow screens. */
export function LinkTabs({ items, label }: { items: { href: string; label: ReactNode; active: boolean }[]; label: string }) {
  return (
    <nav aria-label={label} className="scrollbar-none relative -mx-4 mb-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium",
            i.active ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function formatDate(d: Date | string | null | undefined) {
  return d ? dateFmt.format(new Date(d)) : "—";
}

export function formatDateTime(d: Date | string | null | undefined) {
  return d ? dateTimeFmt.format(new Date(d)) : "—";
}

/** "Brand Name" unless the product name already starts with the brand. */
export function productTitle(brand: string | null | undefined, name: string) {
  if (!brand || name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}
