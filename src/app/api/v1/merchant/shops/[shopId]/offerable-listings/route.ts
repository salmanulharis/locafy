import { api, ok } from "@/lib/http";
import { offerableListings } from "@/modules/offers/service";
import { pathId } from "../../../../_lib/helpers";

/** GET /api/v1/merchant/shops/{shopId}/offerable-listings — listings that can be attached to an offer. */
export const GET = api<{ shopId: string }>(async ({ ctx, params }) => ok(await offerableListings(ctx, pathId(params.shopId, "Shop"))));
