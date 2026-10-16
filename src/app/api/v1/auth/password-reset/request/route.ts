import { api, readJson } from "@/lib/http";
import * as auth from "@/modules/auth/service";
import { done } from "../../../_lib/helpers";

/** POST /api/v1/auth/password-reset/request — { email }. Always succeeds (no account enumeration). */
export const POST = api(async ({ req, ctx }) => {
  await auth.requestPasswordReset(ctx, await readJson(req));
  return done({ status: 202 });
});
