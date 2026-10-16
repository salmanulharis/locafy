import { api, ok } from "@/lib/http";
import { listShopReviewsForMerchant } from "@/modules/reviews/service";
import { pathId } from "../../../../_lib/helpers";

/** GET /api/v1/merchant/shops/{shopId}/reviews — includes hidden reviews (owner/manager). */
export const GET = api<{ shopId: string }>(async ({ ctx, params }) => {
  const r = await listShopReviewsForMerchant(ctx, pathId(params.shopId, "Shop"));
  return ok(r.items, { average: r.average, count: r.count });
});
