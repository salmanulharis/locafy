import { randomBytes } from "node:crypto";

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Slug with a short random suffix to avoid collisions without a lookup loop. */
export function uniqueSlug(input: string): string {
  const base = slugify(input) || "item";
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** Lowercase, collapse whitespace and strip punctuation for identity comparison. */
export function normalizeKey(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
