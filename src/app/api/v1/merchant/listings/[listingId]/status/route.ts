import { z } from "zod";
import { api, ok, readJson } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { changeListingStatus, getMerchantListing } from "@/modules/listings/service";
import { pathId } from "../../../../_lib/helpers";

const bodySchema = z.object({ action: z.enum(["publish", "unpublish", "archive", "discontinue", "restore"]) });

/** POST /api/v1/merchant/listings/{listingId}/status — { action: publish|unpublish|archive|discontinue|restore }. */
export const POST = api<{ listingId: string }>(async ({ req, ctx, params }) => {
  const id = pathId(params.listingId, "Listing");
  const { action } = parseInput(bodySchema, await readJson(req));
  await changeListingStatus(ctx, id, action);
  const { listing } = await getMerchantListing(ctx, id);
  return ok({ id: listing.id, status: listing.status });
});
