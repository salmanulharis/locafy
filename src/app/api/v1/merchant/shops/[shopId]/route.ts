import { api, ok, readJson } from "@/lib/http";
import { getMerchantShop, onboardingGaps, updateShopBasics } from "@/modules/shops/service";
import { pathId } from "../../../_lib/helpers";

type P = { shopId: string };

async function view(ctx: Parameters<typeof getMerchantShop>[0], shopId: string) {
  const { shop, role, branches } = await getMerchantShop(ctx, shopId);
  // The verification note is private to the review process; expose only whether one was given.
  const { verificationNote, ...rest } = shop;
  return { shop: { ...rest, hasVerificationNote: Boolean(verificationNote) }, role, branches, onboardingGaps: await onboardingGaps(shopId) };
}

/** GET /api/v1/merchant/shops/{shopId} — any member. Non-members get 404. */
export const GET = api<P>(async ({ ctx, params }) => ok(await view(ctx, pathId(params.shopId, "Shop"))));

/** PATCH /api/v1/merchant/shops/{shopId} — basics { name, categoryId, description? } (owner/manager). */
export const PATCH = api<P>(async ({ req, ctx, params }) => {
  const shopId = pathId(params.shopId, "Shop");
  await updateShopBasics(ctx, shopId, await readJson(req));
  return ok(await view(ctx, shopId));
});
