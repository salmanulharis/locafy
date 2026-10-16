import { api, searchParamsObject } from "@/lib/http";
import { listShops } from "@/modules/administration/service";
import { paged } from "../../_lib/helpers";

/** GET /api/v1/admin/shops?q=&status=&page=&pageSize= (admin). */
export const GET = api(async ({ req, ctx }) => paged(await listShops(ctx, searchParamsObject(req))));
