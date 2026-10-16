import { api, readJson } from "@/lib/http";
import { savePrimaryBranch } from "@/modules/shops/service";
import { done, pathId } from "../../../../_lib/helpers";

/** PUT /api/v1/merchant/shops/{shopId}/primary-branch — { addressLine, city, lat, lng, name?, locality?, region?, postalCode?, phone? }. */
export const PUT = api<{ shopId: string }>(async ({ req, ctx, params }) => {
  await savePrimaryBranch(ctx, pathId(params.shopId, "Shop"), await readJson(req));
  return done();
});
