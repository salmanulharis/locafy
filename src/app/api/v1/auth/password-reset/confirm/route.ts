import { api, readJson } from "@/lib/http";
import * as auth from "@/modules/auth/service";
import { done } from "../../../_lib/helpers";

/** POST /api/v1/auth/password-reset/confirm — { token, password }. Revokes every session of the account. */
export const POST = api(async ({ req, ctx }) => {
  await auth.resetPassword(ctx, await readJson(req));
  return done();
});
