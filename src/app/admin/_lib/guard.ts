import { notFound, redirect } from "next/navigation";
import { isAppError } from "@/lib/errors";
import { isAdmin } from "@/modules/access/permissions";
import { getCtx, type Ctx } from "@/modules/auth/context";

/**
 * Resolve the request context for an admin page. Signed-out visitors go to
 * login; everyone else who is not an active platform admin gets a 404 so the
 * admin area is not revealed. The services enforce authorisation again.
 */
export async function adminCtx(next = "/admin"): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx.actor) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (ctx.actor.status !== "active" || !isAdmin(ctx.actor)) notFound();
  return ctx;
}

export function isSuperAdmin(ctx: Ctx) {
  return ctx.actor?.platformRole === "super_admin";
}

/** Await a service call, mapping "not found"/invalid ids to the 404 page. */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "VALIDATION_ERROR" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
}
