import { formatMoney, percentOff } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * Price block. `effective` is the price after an active offer; `base` is the
 * shop's regular price; `mrp` the optional list price. Savings shown only when real.
 */
export function Price({
  effective,
  base,
  mrp,
  currency = "INR",
  size = "md",
  className,
}: {
  effective: number;
  base?: number | null;
  mrp?: number | null;
  currency?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const reference = base && base > effective ? base : mrp && mrp > effective ? mrp : null;
  const pct = reference ? percentOff(effective, reference) : 0;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-semibold tabular text-strong", size === "sm" && "text-base", size === "md" && "text-price", size === "lg" && "text-2xl")}>
        {formatMoney(effective, currency)}
      </span>
      {reference && (
        <>
          <span className="text-sm text-muted line-through tabular">
            <span className="sr-only">Regular price </span>
            {formatMoney(reference, currency)}
          </span>
          {pct > 0 && <span className="text-sm font-medium text-success-soft-fg">{pct}% off</span>}
        </>
      )}
    </div>
  );
}
