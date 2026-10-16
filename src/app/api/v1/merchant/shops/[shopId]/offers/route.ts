import { api, ok, readJson } from "@/lib/http";
import { createOffer, listShopOffers } from "@/modules/offers/service";
import { created, pathId } from "../../../../_lib/helpers";

type P = { shopId: string };

/** GET /api/v1/merchant/shops/{shopId}/offers — all offers with their phase. */
export const GET = api<P>(async ({ ctx, params }) => ok(await listShopOffers(ctx, pathId(params.shopId, "Shop"))));

/**
 * POST /api/v1/merchant/shops/{shopId}/offers —
 * { title, description?, conditions?, discountType: percent|amount_off|fixed_price, discountValue, startsAt, endsAt, listingIds[], publish? }.
 */
export const POST = api<P>(async ({ req, ctx, params }) => {
  const body = await readJson(req);
  const publish = Boolean(body && typeof body === "object" && (body as { publish?: unknown }).publish === true);
  return ok(await createOffer(ctx, pathId(params.shopId, "Shop"), body, publish), undefined, created);
});
