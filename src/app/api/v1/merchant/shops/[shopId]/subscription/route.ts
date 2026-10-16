import { api, ok } from "@/lib/http";
import { getShopSubscription } from "@/modules/subscriptions/service";
import { pathId } from "../../../../_lib/helpers";

/** GET /api/v1/merchant/shops/{shopId}/subscription — plan, entitlements and usage (owner). */
export const GET = api<{ shopId: string }>(async ({ ctx, params }) => ok(await getShopSubscription(ctx, pathId(params.shopId, "Shop"))));
