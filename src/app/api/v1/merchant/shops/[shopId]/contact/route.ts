import { api, readJson } from "@/lib/http";
import { updateShopContact } from "@/modules/shops/service";
import { done, pathId } from "../../../../_lib/helpers";

/**
 * PUT /api/v1/merchant/shops/{shopId}/contact — { phone, whatsapp?, email?, website?, openingHours? }.
 * openingHours: { mon: [{ open: "09:00", close: "18:00" }], ... } applied to the primary branch.
 */
export const PUT = api<{ shopId: string }>(async ({ req, ctx, params }) => {
  await updateShopContact(ctx, pathId(params.shopId, "Shop"), await readJson(req));
  return done();
});
