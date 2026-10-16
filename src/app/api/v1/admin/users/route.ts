import { api, searchParamsObject } from "@/lib/http";
import { listUsers } from "@/modules/administration/service";
import { paged } from "../../_lib/helpers";

/** GET /api/v1/admin/users?q=&status=active|suspended|deleted|deletion_requested&page=&pageSize= (admin). */
export const GET = api(async ({ req, ctx }) => paged(await listUsers(ctx, searchParamsObject(req))));
