import { api, readJson } from "@/lib/http";
import { submitVerification } from "@/modules/shops/service";
import { done, pathId } from "../../../../_lib/helpers";

/** POST /api/v1/merchant/shops/{shopId}/submit — { verificationNote } (owner). Sends the shop for admin review. */
export const POST = api<{ shopId: string }>(async ({ req, ctx, params }) => {
  await submitVerification(ctx, pathId(params.shopId, "Shop"), await readJson(req));
  return done();
});
