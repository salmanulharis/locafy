import { errors } from "@/lib/errors";
import { api, ok, searchParamsObject } from "@/lib/http";
import { recordShopView, shopCatalogue } from "@/modules/discovery/service";
import { isSaved } from "@/modules/favourites/service";
import { listActiveOffers } from "@/modules/offers/service";
import { listShopReviews, myReviewFor } from "@/modules/reviews/service";
import { getPublicShopBySlug } from "@/modules/shops/service";
import { locationQuery } from "../../_lib/helpers";

/** GET /api/v1/shops/{slug}?lat=&lng= — public shop profile, catalogue, active offers and reviews. */
export const GET = api<{ slug: string }>(async ({ req, ctx, params }) => {
  const { point } = locationQuery(searchParamsObject(req));
  const shop = await getPublicShopBySlug(ctx, params.slug);
  if (!shop) throw errors.notFound("Shop");
  const [catalogue, offers, reviews, saved, myReview] = await Promise.all([
    shopCatalogue(shop.id, point),
    listActiveOffers({ shopId: shop.id, limit: 20 }),
    listShopReviews(ctx, shop.id),
    ctx.actor ? isSaved(ctx, "shop", shop.id) : Promise.resolve(false),
    ctx.actor ? myReviewFor(ctx, "shop", shop.id) : Promise.resolve(null),
  ]);
  await recordShopView(ctx, shop.id);
  return ok({ shop, catalogue, offers, reviews, viewer: ctx.actor ? { saved, myReview } : null });
});
