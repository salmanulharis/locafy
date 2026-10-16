import { api, ok, readJson } from "@/lib/http";
import { getShopOffer, updateOffer } from "@/modules/offers/service";
import { pathId } from "../../../_lib/helpers";

type P = { offerId: string };

/** GET /api/v1/merchant/offers/{offerId} */
export const GET = api<P>(async ({ ctx, params }) => ok(await getShopOffer(ctx, pathId(params.offerId, "Offer"))));

/** PUT /api/v1/merchant/offers/{offerId} — full replacement, same body as create (publish state unchanged). */
export const PUT = api<P>(async ({ req, ctx, params }) => {
  const id = pathId(params.offerId, "Offer");
  await updateOffer(ctx, id, await readJson(req));
  return ok(await getShopOffer(ctx, id));
});
