import { api, ok, searchParamsObject } from "@/lib/http";
import { listShopEnquiries } from "@/modules/enquiries/service";
import { pathId } from "../../../../_lib/helpers";

/**
 * GET /api/v1/merchant/shops/{shopId}/enquiries?status=open|responded|closed — max 100, latest activity first.
 * Read/reply/close/reopen a thread with /api/v1/enquiries/{id}/... (shared by customer and shop team).
 */
export const GET = api<{ shopId: string }>(async ({ req, ctx, params }) => {
  const items = await listShopEnquiries(ctx, pathId(params.shopId, "Shop"), searchParamsObject(req));
  return ok(items, { total: items.length });
});
