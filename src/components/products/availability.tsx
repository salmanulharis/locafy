import { CircleCheck, CircleDashed, CircleMinus, CircleAlert, Clock } from "lucide-react";
import { STOCK_LABELS, stockFreshness, type StockStatus } from "@/modules/inventory/rules";
import { cn } from "@/lib/cn";

const STYLE: Record<StockStatus, { icon: typeof CircleCheck; className: string }> = {
  in_stock: { icon: CircleCheck, className: "text-success-soft-fg" },
  low_stock: { icon: CircleAlert, className: "text-warning-soft-fg" },
  out_of_stock: { icon: CircleMinus, className: "text-danger-soft-fg" },
  unknown: { icon: CircleDashed, className: "text-muted" },
};

export function relativeTime(date: Date, now: Date = new Date()): string {
  const s = Math.round((now.getTime() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

/**
 * Availability with explicit freshness. Status is communicated by icon AND
 * text, never colour alone. Stock is merchant-reported, not real-time.
 */
export function Availability({ status, updatedAt, compact }: { status: StockStatus; updatedAt: Date; compact?: boolean }) {
  const { icon: Icon, className } = STYLE[status];
  const freshness = stockFreshness(updatedAt);
  const stale = freshness === "stale" && status !== "out_of_stock";
  return (
    <div className={cn("flex flex-col gap-0.5", compact ? "text-xs" : "text-sm")}>
      <span className={cn("inline-flex items-center gap-1.5 font-medium", stale ? "text-muted" : className)}>
        <Icon className="size-4 shrink-0" aria-hidden />
        {stale ? `${STOCK_LABELS[status]} (may be outdated)` : STOCK_LABELS[status]}
      </span>
      <span className={cn("inline-flex items-center gap-1 text-muted", stale && "text-warning-soft-fg")}>
        <Clock className="size-3.5 shrink-0" aria-hidden />
        <span>
          Updated by shop {relativeTime(updatedAt)}
        </span>
      </span>
    </div>
  );
}
