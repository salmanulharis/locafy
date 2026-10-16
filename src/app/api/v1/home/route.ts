import { api, ok, searchParamsObject } from "@/lib/http";
import { nearbyProducts, nearbyShops, popularProducts } from "@/modules/discovery/service";
import { listActiveOffers } from "@/modules/offers/service";
import { locationQuery } from "../_lib/helpers";

/** GET /api/v1/home?lat=&lng=&radiusKm= — home feed sections. Empty sections are returned empty, never padded. */
export const GET = api(async ({ req }) => {
  const { point, radiusKm } = locationQuery(searchParamsObject(req));
  const [nearby, popular, offers, shops] = await Promise.all([
    nearbyProducts(point, radiusKm, 12),
    popularProducts(point, radiusKm, 12),
    listActiveOffers({ point, radiusKm, limit: 10 }),
    nearbyShops(point, radiusKm, { limit: 10 }),
  ]);
  return ok({ nearbyProducts: nearby, popularProducts: popular, offers, shops }, { hasLocation: Boolean(point), radiusKm });
});
