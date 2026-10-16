import { z } from "zod";
import { errors, type FieldErrors } from "./errors";

/** Parse untrusted input with a Zod schema, throwing a VALIDATION_ERROR with per-field messages. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  throw errors.validation("Please check the highlighted fields.", fieldErrors);
}

/** Convert FormData to a plain object; repeated keys become arrays, empty strings become undefined. */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of fd.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const value = typeof raw === "string" ? (raw.trim() === "" ? undefined : raw) : raw;
    if (key.endsWith("[]")) {
      const k = key.slice(0, -2);
      const arr = (out[k] as unknown[]) ?? [];
      if (value !== undefined) arr.push(value);
      out[k] = arr;
    } else if (key in out && value !== undefined) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else if (!(key in out)) {
      out[key] = value;
    }
  }
  return out;
}

// Reusable field schemas -----------------------------------------------------

export const uuidSchema = z.string().uuid("Invalid identifier.");

export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,20}$/, "Enter a valid phone number.");

export const optionalUrl = z
  .string()
  .trim()
  .url("Enter a full URL starting with https://")
  .refine((u) => /^https?:\/\//i.test(u), "Only http(s) links are allowed.")
  .optional();

/** Accepts "1499", "1,499.50" or a number in major units; returns minor units. */
export const moneySchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const s = typeof v === "number" ? String(v) : v.replace(/[,\s]/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount (up to 2 decimals)." });
      return z.NEVER;
    }
    const [whole, frac = ""] = s.split(".");
    const minor = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    if (!Number.isSafeInteger(minor) || minor > 2_000_000_000) {
      ctx.addIssue({ code: "custom", message: "Amount is too large." });
      return z.NEVER;
    }
    return minor;
  });

export const checkbox = z
  .union([z.boolean(), z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
  .transform((v) => v === true || v === "on" || v === "true");
