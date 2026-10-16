import { api, ok, searchParamsObject } from "@/lib/http";
import { listReports } from "@/modules/administration/service";

/** GET /api/v1/admin/reports?status=open|actioned|dismissed&page=&pageSize= (admin). */
export const GET = api(async ({ req, ctx }) => {
  const sp = searchParamsObject(req);
  const items = await listReports(ctx, sp);
  return ok(items, { page: Number(sp.page ?? 1) || 1, pageSize: Number(sp.pageSize ?? 20) || 20 });
});
