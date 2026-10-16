import { api, ok, readJson } from "@/lib/http";
import { listPlans, savePlan } from "@/modules/administration/service";
import { created, done } from "../../_lib/helpers";

/** GET /api/v1/admin/plans — plans with live subscriber counts (admin). */
export const GET = api(async ({ ctx }) => {
  const rows = await listPlans(ctx);
  return ok(rows.map((r) => ({ ...r.plan, subscribers: r.subscribers })));
});

/** POST /api/v1/admin/plans — create a plan (super admin). See docs/api.md for the body. */
export const POST = api(async ({ req, ctx }) => {
  await savePlan(ctx, null, await readJson(req));
  return done(created);
});
