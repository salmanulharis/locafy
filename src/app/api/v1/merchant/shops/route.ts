import { api, ok, readJson } from "@/lib/http";
import { createShop, listMyShops } from "@/modules/shops/service";
import { created } from "../../_lib/helpers";

/** GET /api/v1/merchant/shops — shops the caller is a member of, with their role. */
export const GET = api(async ({ ctx }) => ok(await listMyShops(ctx)));

/** POST /api/v1/merchant/shops — { name, categoryId, description? }. Creates a draft shop owned by the caller. */
export const POST = api(async ({ req, ctx }) => {
  const shop = await createShop(ctx, await readJson(req));
  return ok({ id: shop.id, slug: shop.slug, name: shop.name, status: shop.status, onboardingStep: shop.onboardingStep }, undefined, created);
});
