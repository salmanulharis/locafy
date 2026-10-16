import { api, ok, readJson } from "@/lib/http";
import { addMember, listMembers } from "@/modules/shops/service";
import { created, done, pathId } from "../../../../_lib/helpers";

type P = { shopId: string };

/** GET /api/v1/merchant/shops/{shopId}/members — the shop's team (any member). */
export const GET = api<P>(async ({ ctx, params }) => ok(await listMembers(ctx, pathId(params.shopId, "Shop"))));

/** POST /api/v1/merchant/shops/{shopId}/members — { email, role: manager|staff } (owner). The person must already have an account. */
export const POST = api<P>(async ({ req, ctx, params }) => {
  await addMember(ctx, pathId(params.shopId, "Shop"), await readJson(req));
  return done(created);
});
