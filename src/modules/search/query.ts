/**
 * Pure query-building helpers for product search (unit-tested).
 */

/** Lowercase alphanumeric tokens; everything else is a separator. Safe to embed in to_tsquery. */
export function tokenize(q: string): string[] {
  return q
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .slice(0, 8);
}

const STOP = new Set(["a", "an", "the", "and", "or", "for", "of", "in", "with", "near", "me", "buy", "shop"]);

export type SynonymMap = Map<string, string[]>;

/**
 * Build a to_tsquery expression: every token must match (AND; any token with
 * joiner "or" for relaxed matching), each token can
 * be satisfied by any of its synonyms (OR), and the final token is a prefix so
 * partially typed words still match ("samsu" -> samsung).
 */
export function buildTsQuery(q: string, synonyms: SynonymMap = new Map(), joiner: "and" | "or" = "and"): string | null {
  const tokens = tokenize(q).filter((t) => !STOP.has(t));
  if (!tokens.length) return null;
  const groups = tokens.map((t, idx) => {
    const isLast = idx === tokens.length - 1;
    const alts = new Set<string>([isLast && t.length >= 2 ? `${t}:*` : t]);
    for (const s of synonyms.get(t) ?? []) {
      const words = tokenize(s);
      if (words.length === 1) alts.add(words[0]!);
      else if (words.length > 1) alts.add(`(${words.join(" <-> ")})`);
    }
    return alts.size > 1 ? `(${[...alts].join(" | ")})` : [...alts][0]!;
  });
  return groups.join(joiner === "and" ? " & " : " | ");
}

export type SearchSort = "relevance" | "price" | "distance" | "rating";

export function normaliseQuery(q: string | undefined | null): string {
  return (q ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export type MatchMode = "exact" | "partial" | "fuzzy" | "browse";

/** Minimum trigram word similarity for the spelling-tolerant fallback. */
export const FUZZY_THRESHOLD = 0.5;
