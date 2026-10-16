import { api, ok } from "@/lib/http";
import { getShopOffer, setOfferPublished } from "@/modules/offers/service";
import { pathId } from "../../../../_lib/helpers";

/** POST /api/v1/merchant/offers/{offerId}/publish — counts towards the plan's active-offer limit. */
export const POST = api<{ offerId: string }>(async ({ ctx, params }) => {
  const id = pathId(params.offerId, "Offer");
  await setOfferPublished(ctx, id, true);
  return ok(await getShopOffer(ctx, id));
});
