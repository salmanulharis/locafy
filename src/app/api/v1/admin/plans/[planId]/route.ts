import { api, readJson } from "@/lib/http";
import { savePlan } from "@/modules/administration/service";
import { done, pathId } from "../../../_lib/helpers";

/** PUT /api/v1/admin/plans/{planId} — full replacement of a plan (super admin). */
export const PUT = api<{ planId: string }>(async ({ req, ctx, params }) => {
  await savePlan(ctx, pathId(params.planId, "Plan"), await readJson(req));
  return done();
});
