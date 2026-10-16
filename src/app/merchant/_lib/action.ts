import { isAppError } from "@/lib/errors";
import { runAction, type ActionState } from "@/lib/actions";
import type { Ctx } from "@/modules/auth/context";

export type MerchantActionData = { code?: string; [k: string]: unknown };

/**
 * `runAction` plus the error code in `data.code`, so forms can show
 * plan-limit and concurrent-edit notices inline (with a link to the Plan page).
 */
export async function merchantAction<T>(fn: (ctx: Ctx) => Promise<T | void>, successMessage?: string): Promise<ActionState<MerchantActionData>> {
  let code: string | undefined;
  const state = await runAction(async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (isAppError(e)) code = e.code;
      throw e;
    }
  }, successMessage);
  if (code) return { ...state, data: { code } };
  return state as ActionState<MerchantActionData>;
}

/** Read a string form value ("" → undefined). */
export function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}
