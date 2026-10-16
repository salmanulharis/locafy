import { api } from "@/lib/http";
import * as auth from "@/modules/auth/service";
import { clearSessionCookie, done } from "../../_lib/helpers";

/** POST /api/v1/auth/logout — revokes the current session (bearer token or cookie). Idempotent. */
export const POST = api(async ({ ctx }) => {
  await auth.logout(ctx);
  return clearSessionCookie(done());
});
