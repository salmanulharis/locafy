import { normalizeKey } from "@/lib/text";

/**
 * Product identity key. Two catalogue entries are the same product only if
 * brand, model (or name when no model is given) AND variant all match after
 * normalisation. Different storage sizes, colours or pack sizes therefore stay
 * distinct products and are never merged in price comparison.
 */
export function productIdentityKey(p: {
  brand?: string | null;
  model?: string | null;
  name: string;
  variant?: string | null;
}): string {
  const brand = normalizeKey(p.brand);
  const base = normalizeKey(p.model) || normalizeKey(p.name);
  const variant = normalizeKey(p.variant);
  return [brand || "-", base, variant || "-"].join("|");
}

/** Text indexed for full-text + trigram search. */
export function buildSearchText(p: {
  name: string;
  brand?: string | null;
  brandAliases?: string[];
  model?: string | null;
  variant?: string | null;
  aliases?: string[];
  category?: string | null;
  specs?: Record<string, string>;
}): string {
  const specValues = Object.values(p.specs ?? {}).filter((v) => v.length <= 40);
  return [p.name, p.brand, ...(p.brandAliases ?? []), p.model, p.variant, ...(p.aliases ?? []), p.category, ...specValues]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
