import { api, readJson } from "@/lib/http";
import { recordClientEvent } from "@/modules/analytics/service";
import { done } from "../_lib/helpers";

/** POST /api/v1/events — { type: contact_click|direction_request|offer_view, shopId, listingId?, offerId? }. */
export const POST = api(async ({ req, ctx }) => {
  await recordClientEvent(ctx, await readJson(req));
  return done({ status: 202 });
});
