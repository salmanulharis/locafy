import { api } from "@/lib/http";
import { removeListingImage } from "@/modules/listings/service";
import { done, pathId } from "../../../../../_lib/helpers";

/** DELETE /api/v1/merchant/listings/{listingId}/images/{imageId} — remove a shop-uploaded listing photo. */
export const DELETE = api<{ listingId: string; imageId: string }>(async ({ ctx, params }) => {
  await removeListingImage(ctx, pathId(params.listingId, "Listing"), pathId(params.imageId, "Image"));
  return done();
});
