/**
 * Transport-only helpers shared by /api/v1 route handlers: path-id parsing,
 * location query parsing, response shaping and session cookies. No business
 * rules live here; those stay in src/modules/*.
 */
import type { NextResponse } from "next/server";
import { z } from "zod";
import { errors } from "@/lib/errors";
import { ok, type ApiMeta } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import type { Ctx } from "@/modules/auth/context";
import { SESSION_COOKIE } from "@/modules/auth/sessions";
import { DEFAULT_RADIUS_KM, type LatLng } from "@/modules/geo/geo";

const uuid = z.string().uuid();

/** Path ids that are not UUIDs can never exist: answer 404 rather than a DB error. */
export function pathId(value: string | undefined, what = "Resource"): string {
  if (!value || !uuid.safeParse(value).success) throw errors.notFound(what);
  return value;
}

const locationQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90, "Invalid latitude.").max(90, "Invalid latitude.").optional(),
    lng: z.coerce.number().min(-180, "Invalid longitude.").max(180, "Invalid longitude.").optional(),
    radiusKm: z.coerce.number().min(1).max(200).default(DEFAULT_RADIUS_KM),
  })
  .refine((p) => (p.lat === undefined) === (p.lng === undefined), { message: "Send both lat and lng, or neither.", path: ["lat"] });

/** `?lat=&lng=&radiusKm=` → point (null when absent or 0,0) + radius. */
export function locationQuery(sp: Record<string, string>): { point: LatLng | null; radiusKm: number } {
  const p = parseInput(locationQuerySchema, { lat: sp.lat || undefined, lng: sp.lng || undefined, radiusKm: sp.radiusKm || undefined });
  const point = p.lat !== undefined && p.lng !== undefined && !(p.lat === 0 && p.lng === 0) ? { lat: p.lat, lng: p.lng } : null;
  return { point, radiusKm: p.radiusKm };
}

/** `{ data: items, meta: { page, pageSize, total } }` from a paginated service result. */
export function paged<T>(r: { items: T[]; page: number; pageSize: number; total: number }, extra?: ApiMeta) {
  return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total, ...extra });
}

/** Uniform body for operations that have nothing to return. */
export function done(init?: ResponseInit) {
  return ok({ ok: true }, undefined, init);
}

export const created = { status: 201 } as const;

export type ClientKind = "web" | "mobile";

export function readClient(body: unknown): ClientKind {
  const raw = (body as { client?: unknown } | null)?.client;
  return parseInput(z.enum(["web", "mobile"]).default("mobile"), raw ?? undefined);
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

/**
 * Web (cookie) sign-in through the API must come from this app's own origin,
 * mirroring the CSRF rule `api()` applies to authenticated cookie writes, so a
 * third-party page cannot log a browser into an attacker's account.
 */
export function assertSameOriginForCookieLogin(req: Request) {
  const referer = req.headers.get("referer");
  const origin = req.headers.get("origin") ?? (referer ? safeOrigin(referer) : null);
  const allowed = new Set([new URL(req.url).origin, process.env.APP_URL?.replace(/\/$/, "")].filter(Boolean));
  if (!origin || !allowed.has(origin)) throw errors.forbidden("Cross-site request blocked.");
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Return a session to the caller in the form its client expects. */
export function sessionResponse(
  ctxOrClient: Ctx | ClientKind,
  session: { token: string; expiresAt: Date; user: unknown },
  init?: ResponseInit,
) {
  const client: ClientKind = typeof ctxOrClient === "string" ? ctxOrClient : ctxOrClient.authMethod === "cookie" ? "web" : "mobile";
  if (client === "web") {
    return setSessionCookie(ok({ user: session.user, expiresAt: session.expiresAt }, undefined, init), session.token, session.expiresAt);
  }
  return ok({ token: session.token, expiresAt: session.expiresAt, user: session.user }, undefined, init);
}

/** Parse an `If-Match` header carrying an inventory version ("3", "\"3\"" or W/"3"). */
export function ifMatchVersion(req: Request): number | undefined {
  const raw = req.headers.get("if-match");
  if (!raw) return undefined;
  const m = raw.trim().match(/^(?:W\/)?"?(\d{1,9})"?$/);
  if (!m) throw errors.validation("If-Match must be the inventory version number, e.g. If-Match: \"3\".");
  return Number(m[1]);
}
