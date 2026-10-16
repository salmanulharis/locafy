import { api, ok, readJson, searchParamsObject } from "@/lib/http";
import { createListing, listMerchantListings } from "@/modules/listings/service";
import { created, paged, pathId } from "../../../../_lib/helpers";

type P = { shopId: string };

/** GET /api/v1/merchant/shops/{shopId}/listings?q=&status=&stock=&sort=updated|name|price&page=&pageSize= */
export const GET = api<P>(async ({ req, ctx, params }) =>
  paged(await listMerchantListings(ctx, pathId(params.shopId, "Shop"), searchParamsObject(req))),
);

/**
 * POST /api/v1/merchant/shops/{shopId}/listings —
 * { catalogProductId | product: {...}, notes?, stock: [{ branchId, price, mrp?, quantity?, stockStatus?, lowStockThreshold? }], publish? }.
 * Prices are major units ("1499.50"); responses use minor units.
 */
export const POST = api<P>(async ({ req, ctx, params }) =>
  ok(await createListing(ctx, pathId(params.shopId, "Shop"), await readJson(req)), undefined, created),
);
