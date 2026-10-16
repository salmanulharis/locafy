import { unstable_rethrow } from "next/navigation";
import { getCtx, type Ctx } from "@/modules/auth/context";
import { logError } from "@/modules/platform/audit";
import { isAppError, type FieldErrors } from "./errors";

/** State returned by every server action; consumed by `useActionState` forms. */
export type ActionState<T = unknown> = {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  data?: T;
  /** Changes on every submission so the UI can show repeated toasts. */
  at?: number;
};

export const initialActionState: ActionState = { ok: false };

/**
 * Run a server action body with the request context and convert failures to
 * user-safe ActionState. Business rules live in the services, not here.
 */
export async function runAction<T>(fn: (ctx: Ctx) => Promise<T | void>, successMessage?: string): Promise<ActionState<T>> {
  let ctx: Ctx | undefined;
  try {
    ctx = await getCtx();
    const data = (await fn(ctx)) ?? undefined;
    return { ok: true, message: successMessage, data: data as T, at: Date.now() };
  } catch (e) {
    unstable_rethrow(e);
    if (isAppError(e)) return { ok: false, message: e.message, fieldErrors: e.fieldErrors, at: Date.now() };
    await logError(e, { requestId: ctx?.requestId, route: "server-action" });
    return { ok: false, message: "Something went wrong. Please try again.", at: Date.now() };
  }
}
