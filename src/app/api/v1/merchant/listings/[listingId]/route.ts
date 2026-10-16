import { api, ok, readJson } from "@/lib/http";
import { getMerchantListing, updateListing } from "@/modules/listings/service";
import { pathId } from "../../../_lib/helpers";

type P = { listingId: string };

/** GET /api/v1/merchant/listings/{listingId} — listing, product, per-branch stock (with version), images, history. */
export const GET = api<P>(async ({ ctx, params }) => ok(await getMerchantListing(ctx, pathId(params.listingId, "Listing"))));

/** PATCH /api/v1/merchant/listings/{listingId} — { notes?, product? } (product only when the catalogue entry is yours to edit). */
export const PATCH = api<P>(async ({ req, ctx, params }) => {
  const id = pathId(params.listingId, "Listing");
  await updateListing(ctx, id, await readJson(req));
  return ok(await getMerchantListing(ctx, id));
});
