import { api, ok } from "@/lib/http";
import { getShopForAdmin } from "@/modules/administration/service";
import { pathId } from "../../../_lib/helpers";

/** GET /api/v1/admin/shops/{shopId} — full record incl. verification note, members, branches, plan, history (admin). */
export const GET = api<{ shopId: string }>(async ({ ctx, params }) => ok(await getShopForAdmin(ctx, pathId(params.shopId, "Shop"))));
