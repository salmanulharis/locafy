import { api, readJson } from "@/lib/http";
import { resolveReport } from "@/modules/administration/service";
import { done, pathId } from "../../../../_lib/helpers";

/** POST /api/v1/admin/reports/{reportId}/resolve — { outcome: actioned|dismissed, note }. Resolves all open reports on the same target. */
export const POST = api<{ reportId: string }>(async ({ req, ctx, params }) => {
  await resolveReport(ctx, pathId(params.reportId, "Report"), await readJson(req));
  return done();
});
