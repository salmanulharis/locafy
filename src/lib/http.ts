import { NextResponse } from "next/server";
import { getRequestCtx, type Ctx } from "@/modules/auth/context";
import { logError } from "@/modules/platform/audit";
import { AppError, errors, isAppError } from "./errors";

/**
 * Versioned JSON API conventions (see docs/api.md):
 *   success: { data, meta? }
 *   error:   { error: { code, message, fieldErrors?, details?, requestId } }
 */
export type ApiMeta = { page?: number; pageSize?: number; total?: number; [k: string]: unknown };

export function ok<T>(data: T, meta?: ApiMeta, init?: ResponseInit) {
  return NextResponse.json(meta ? { data, meta } : { data }, init);
}

export function errorResponse(e: AppError, requestId: string) {
  const headers: Record<string, string> = { "x-request-id": requestId };
  if (e.code === "RATE_LIMITED" && e.details?.retryAfterSeconds) headers["Retry-After"] = String(e.details.retryAfterSeconds);
  return NextResponse.json(
    {
      error: {
        code: e.code,
        message: e.message,
        ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}),
        ...(e.details ? { details: e.details } : {}),
        requestId,
      },
    },
    { status: e.status, headers },
  );
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for cookie-authenticated, state-changing API calls: the Origin
 * (or Referer) must match this app. Bearer-token clients (mobile) are exempt
 * because browsers never attach bearer tokens automatically.
 */
function assertSameOrigin(req: Request, ctx: Ctx) {
  if (SAFE_METHODS.has(req.method) || ctx.authMethod !== "cookie") return;
  const origin = req.headers.get("origin") ?? (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null);
  const self = new URL(req.url).origin;
  const allowed = new Set([self, process.env.APP_URL?.replace(/\/$/, "")].filter(Boolean));
  if (!origin || !allowed.has(origin)) throw errors.forbidden("Cross-site request blocked.");
}

type Handler<P> = (args: { req: Request; ctx: Ctx; params: P }) => Promise<Response>;

/** Wrap a route handler with context resolution, CSRF checks and uniform error handling. */
export function api<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: Request, routeCtx: { params: Promise<P> }) => {
    let requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const ctx = await getRequestCtx(req);
      requestId = ctx.requestId;
      assertSameOrigin(req, ctx);
      const params = routeCtx?.params ? await routeCtx.params : ({} as P);
      const res = await handler({ req, ctx, params });
      res.headers.set("x-request-id", requestId);
      if (!res.headers.has("cache-control")) res.headers.set("cache-control", "no-store");
      return res;
    } catch (e) {
      if (isAppError(e)) return errorResponse(e, requestId);
      await logError(e, { requestId, route: new URL(req.url).pathname });
      return errorResponse(new AppError("INTERNAL_ERROR", "Something went wrong. Please try again."), requestId);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw errors.validation("Send a JSON body with Content-Type: application/json.");
  const text = await req.text();
  if (text.length > 100_000) throw new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw errors.validation("Request body is not valid JSON.");
  }
}

export function searchParamsObject(req: Request): Record<string, string> {
  return Object.fromEntries(new URL(req.url).searchParams.entries());
}
