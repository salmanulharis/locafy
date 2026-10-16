import { api, readJson } from "@/lib/http";
import { errors } from "@/lib/errors";
import * as auth from "@/modules/auth/service";
import { sessionResponse } from "../../_lib/helpers";

/**
 * POST /api/v1/me/password — { currentPassword, newPassword }.
 * Every existing session (including this one) is revoked; a fresh session is
 * issued for the caller: a new bearer token for mobile, a new cookie for web.
 */
export const POST = api(async ({ req, ctx }) => {
  const body = (await readJson(req)) as { newPassword?: unknown } | null;
  await auth.changePassword(ctx, body);
  const email = ctx.actor?.email;
  if (!email) throw errors.unauthenticated();
  const session = await auth.login(ctx, { email, password: body?.newPassword }, ctx.authMethod === "cookie" ? "web" : "mobile");
  return sessionResponse(ctx, session);
});
