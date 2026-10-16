import { api, ok, readJson } from "@/lib/http";
import { createReport } from "@/modules/reports/service";
import { created } from "../_lib/helpers";

/** POST /api/v1/reports — { targetType, targetId, reason, details? }. Repeat reports merge into your open one. */
export const POST = api(async ({ req, ctx }) => {
  const r = await createReport(ctx, await readJson(req));
  return ok(r, undefined, r.duplicate ? undefined : created);
});
