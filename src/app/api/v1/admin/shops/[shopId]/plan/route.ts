import { api, readJson } from "@/lib/http";
import { assignPlan } from "@/modules/administration/service";
import { done, pathId } from "../../../../_lib/helpers";

/** POST /api/v1/admin/shops/{shopId}/plan — { planId, periodDays? }: manually assign a plan (admin). */
export const POST = api<{ shopId: string }>(async ({ req, ctx, params }) => {
  await assignPlan(ctx, pathId(params.shopId, "Shop"), await readJson(req));
  return done();
});
