import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, validateSessionToken, type SessionUser } from "./sessions";

/**
 * Per-request context passed to every application service. It is the single
 * place where the caller's identity is resolved, for both web (cookie) and
 * future mobile clients (Authorization: Bearer <token>).
 */
export type Ctx = {
  actor: SessionUser | null;
  sessionToken: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
  /** "cookie" requests need Origin checks for state changes; bearer requests do not. */
  authMethod: "cookie" | "bearer" | "none";
};

export function clientIp(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim().slice(0, 64);
  return h.get("x-real-ip")?.slice(0, 64) ?? null;
}

function bearerToken(h: Headers): string | null {
  const auth = h.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

async function build(h: Headers, cookieToken: string | null): Promise<Ctx> {
  const bearer = bearerToken(h);
  const token = bearer ?? cookieToken;
  const session = token ? await validateSessionToken(token) : null;
  return {
    actor: session?.user ?? null,
    sessionToken: session ? token : null,
    ip: clientIp(h),
    userAgent: h.get("user-agent"),
    requestId: h.get("x-request-id") ?? randomUUID(),
    authMethod: session ? (bearer ? "bearer" : "cookie") : "none",
  };
}

/** Context for Server Components and Server Actions. */
export async function getCtx(): Promise<Ctx> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return build(h, c.get(SESSION_COOKIE)?.value ?? null);
}

/** Context for Route Handlers (API). */
export async function getRequestCtx(req: Request): Promise<Ctx> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return build(req.headers, match ? decodeURIComponent(match[1]!) : null);
}

/** Anonymous system context for scripts and tests. */
export function systemCtx(actor: SessionUser | null = null): Ctx {
  return {
    actor,
    sessionToken: null,
    ip: null,
    userAgent: "system",
    requestId: randomUUID(),
    authMethod: actor ? "bearer" : "none",
  };
}
