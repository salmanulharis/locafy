import { api, readJson } from "@/lib/http";
import * as auth from "@/modules/auth/service";
import { assertSameOriginForCookieLogin, readClient, sessionResponse } from "../../_lib/helpers";

/**
 * POST /api/v1/auth/login — { email, password, client? }.
 * client "mobile" (default) returns { token, expiresAt, user }; "web" sets the httpOnly cookie.
 */
export const POST = api(async ({ req, ctx }) => {
  const body = await readJson(req);
  const client = readClient(body);
  if (client === "web") assertSameOriginForCookieLogin(req);
  const r = await auth.login(ctx, body, client);
  return sessionResponse(client, r);
});
