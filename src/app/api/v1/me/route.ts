import { api, ok, readJson } from "@/lib/http";
import * as auth from "@/modules/auth/service";

/** GET /api/v1/me — the signed-in account. */
export const GET = api(async ({ ctx }) => ok(await auth.myAccount(ctx)));

/** PATCH /api/v1/me — { name, phone? } (name is required; omitting phone clears it). */
export const PATCH = api(async ({ req, ctx }) => {
  await auth.updateProfile(ctx, await readJson(req));
  return ok(await auth.myAccount(ctx));
});
