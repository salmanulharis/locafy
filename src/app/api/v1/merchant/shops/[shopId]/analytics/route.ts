import { api, ok, searchParamsObject } from "@/lib/http";
import { shopStats } from "@/modules/analytics/service";
import { pathId } from "../../../../_lib/helpers";

/** GET /api/v1/merchant/shops/{shopId}/analytics?days=7|30|90 (owner/manager). */
export const GET = api<{ shopId: string }>(async ({ req, ctx, params }) =>
  ok(await shopStats(ctx, pathId(params.shopId, "Shop"), searchParamsObject(req))),
);
