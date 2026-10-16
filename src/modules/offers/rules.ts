/** Pure offer rules shared by services, search and UI. */

export type DiscountType = "percent" | "amount_off" | "fixed_price";
export type OfferStatus = "draft" | "published" | "unpublished";
export type OfferPhase = "draft" | "scheduled" | "active" | "expired" | "unpublished";

export function offerPhase(
  o: { status: OfferStatus; startsAt: Date; endsAt: Date },
  now: Date = new Date(),
): OfferPhase {
  if (o.status === "draft") return "draft";
  if (o.status === "unpublished") return "unpublished";
  if (now >= o.endsAt) return "expired";
  if (now < o.startsAt) return "scheduled";
  return "active";
}

/**
 * Price after applying an offer, in minor units. Never below 1 and never above
 * the original price (an offer cannot increase a price).
 */
export function applyDiscount(priceMinor: number, type: DiscountType, value: number): number {
  let next: number;
  switch (type) {
    case "percent":
      next = Math.round(priceMinor * (1 - value / 100));
      break;
    case "amount_off":
      next = priceMinor - value;
      break;
    case "fixed_price":
      next = value;
      break;
  }
  return Math.min(priceMinor, Math.max(1, next));
}

export type OfferValidationIssue = { field: string; message: string };

export function validateOfferWindow(startsAt: Date, endsAt: Date, now: Date = new Date()): OfferValidationIssue[] {
  const issues: OfferValidationIssue[] = [];
  if (Number.isNaN(startsAt.getTime())) issues.push({ field: "startsAt", message: "Enter a valid start date." });
  if (Number.isNaN(endsAt.getTime())) issues.push({ field: "endsAt", message: "Enter a valid end date." });
  if (issues.length) return issues;
  if (endsAt <= startsAt) issues.push({ field: "endsAt", message: "End must be after the start." });
  if (endsAt <= now) issues.push({ field: "endsAt", message: "End must be in the future." });
  if (endsAt.getTime() - startsAt.getTime() > 366 * 86_400_000) {
    issues.push({ field: "endsAt", message: "Offers can run for at most one year." });
  }
  return issues;
}

export function validateDiscount(type: DiscountType, value: number): OfferValidationIssue | null {
  if (!Number.isInteger(value) || value <= 0) return { field: "discountValue", message: "Enter a positive value." };
  if (type === "percent" && (value < 1 || value > 95)) {
    return { field: "discountValue", message: "Percentage must be between 1 and 95." };
  }
  return null;
}

export function describeOffer(type: DiscountType, value: number, fmt: (minor: number) => string): string {
  if (type === "percent") return `${value}% off`;
  if (type === "amount_off") return `${fmt(value)} off`;
  return `Offer price ${fmt(value)}`;
}
