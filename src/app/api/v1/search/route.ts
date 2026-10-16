import { api, ok, searchParamsObject } from "@/lib/http";
import { searchProducts } from "@/modules/search/service";

/**
 * GET /api/v1/search — q, lat, lng, radiusKm, category, brand, minPrice, maxPrice,
 * availability (any|in_stock), offers, minRating, sort (relevance|price|distance|rating), page, pageSize.
 * Public. Prices are minor units; stock is as last reported by the shop (see stockUpdatedAt).
 */
export const GET = api(async ({ req, ctx }) => {
  const r = await searchProducts(ctx, searchParamsObject(req));
  return ok(
    { query: r.query, items: r.items, sponsored: r.sponsored, alternatives: r.alternatives },
    {
      page: r.page,
      pageSize: r.pageSize,
      total: r.total,
      matchMode: r.matchMode,
      hasLocation: r.hasLocation,
      radiusKm: r.radiusKm,
      existsOutsideRadius: r.existsOutsideRadius,
      tookMs: r.tookMs,
    },
  );
});
