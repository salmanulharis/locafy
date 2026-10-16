/**
 * Pure inventory and freshness rules. No I/O so they can be unit-tested and
 * reused by any client (web, future mobile via the API).
 */

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "unknown";

/** Listings not updated within this many days are flagged as stale to customers and merchants. */
export const STALE_AFTER_DAYS = 14;
/** Updates within this window are presented as "recently confirmed". */
export const FRESH_WITHIN_DAYS = 3;

/**
 * Derive stock status from a quantity when the merchant tracks quantities.
 * When quantity is null the merchant's explicitly chosen status is kept.
 */
export function deriveStockStatus(quantity: number | null, threshold: number, explicit?: StockStatus): StockStatus {
  if (quantity == null) return explicit ?? "unknown";
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= threshold) return "low_stock";
  return "in_stock";
}

export type Freshness = "fresh" | "recent" | "stale";

export function stockFreshness(updatedAt: Date, now: Date = new Date()): Freshness {
  const days = (now.getTime() - updatedAt.getTime()) / 86_400_000;
  if (days <= FRESH_WITHIN_DAYS) return "fresh";
  if (days <= STALE_AFTER_DAYS) return "recent";
  return "stale";
}

/** Availability confidence used in ranking: confirmed, fresh stock ranks first. */
export function availabilityScore(status: StockStatus, freshness: Freshness): number {
  const base = { in_stock: 1, low_stock: 0.8, unknown: 0.35, out_of_stock: 0 }[status];
  const factor = { fresh: 1, recent: 0.85, stale: 0.5 }[freshness];
  return base * factor;
}

export type QuantityChange = { mode: "set"; value: number } | { mode: "adjust"; delta: number };

/** Apply a quantity change, rejecting results below zero. */
export function applyQuantityChange(current: number | null, change: QuantityChange): number {
  const next = change.mode === "set" ? change.value : (current ?? 0) + change.delta;
  if (!Number.isInteger(next)) throw new RangeError("Quantity must be a whole number.");
  if (next < 0) throw new RangeError("Stock cannot go below zero.");
  if (next > 1_000_000) throw new RangeError("Quantity is unrealistically large.");
  return next;
}

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  unknown: "Availability not confirmed",
};

/** Statuses a merchant may set explicitly (when not tracking quantities). */
export const STOCK_STATUSES_INPUT = ["in_stock", "low_stock", "out_of_stock", "unknown"] as const;
