import { api, readJson } from "@/lib/http";
import * as auth from "@/modules/auth/service";
import { assertSameOriginForCookieLogin, created, readClient, sessionResponse } from "../../_lib/helpers";

/**
 * POST /api/v1/auth/register — { name, email, password, phone?, client? }.
 * client "mobile" (default) returns a bearer token; "web" sets the session cookie.
 */
export const POST = api(async ({ req, ctx }) => {
  const body = await readJson(req);
  const client = readClient(body);
  if (client === "web") assertSameOriginForCookieLogin(req);
  const r = await auth.register(ctx, body, client);
  return sessionResponse(client, r, created);
});
