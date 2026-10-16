/** Formatting helpers for the admin area. Never invent values: missing data renders as "—". */

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const numFmt = new Intl.NumberFormat("en-IN");

export const DASH = "—";

export function toDate(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(v: unknown): string {
  const d = toDate(v);
  return d ? dateFmt.format(d) : DASH;
}

export function formatDateTime(v: unknown): string {
  const d = toDate(v);
  return d ? dateTimeFmt.format(d) : DASH;
}

export function formatNumber(v: unknown): string {
  if (v == null || v === "") return DASH;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? numFmt.format(n) : DASH;
}

/** Value for a datetime-local input (server local time, minute precision). */
export function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function shortId(id: unknown): string {
  return typeof id === "string" ? id.slice(0, 8) : DASH;
}
