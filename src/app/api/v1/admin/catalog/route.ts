import { api, searchParamsObject } from "@/lib/http";
import { listCatalog } from "@/modules/administration/service";
import { paged } from "../../_lib/helpers";

/** GET /api/v1/admin/catalog?q=&status=active|restricted|merged&page=&pageSize= (admin). */
export const GET = api(async ({ req, ctx }) => paged(await listCatalog(ctx, searchParamsObject(req))));
