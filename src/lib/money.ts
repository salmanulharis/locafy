/** Money helpers. All amounts are integers in minor units (e.g. paise, cents). */

export function formatMoney(minor: number, currency = "INR", locale = "en-IN"): string {
  const major = minor / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/** Major-unit string for form inputs, e.g. 149950 -> "1499.50". */
export function toMajorInput(minor: number | null | undefined): string {
  if (minor == null) return "";
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

export function percentOff(priceMinor: number, referenceMinor: number): number {
  if (referenceMinor <= 0 || priceMinor >= referenceMinor) return 0;
  return Math.round(((referenceMinor - priceMinor) / referenceMinor) * 100);
}
