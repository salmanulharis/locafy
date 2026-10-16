import { NextResponse } from "next/server";
import { errors } from "@/lib/errors";
import { api, ok, searchParamsObject } from "@/lib/http";
import { isSaved } from "@/modules/favourites/service";
import { getProductDetail } from "@/modules/products/service";
import { myReviewFor } from "@/modules/reviews/service";
import { locationQuery } from "../../_lib/helpers";

/**
 * GET /api/v1/products/{slug}?lat=&lng= — product detail with every seller of this exact product.
 * Merged (duplicate) products answer 308 with a Location header pointing at the canonical
 * product and body { data: { redirectTo } }.
 */
export const GET = api<{ slug: string }>(async ({ req, ctx, params }) => {
  const sp = searchParamsObject(req);
  const { point } = locationQuery(sp);
  const detail = await getProductDetail(ctx, params.slug, point);
  if (!detail) throw errors.notFound("Product");
  if (detail.redirectTo !== undefined) {
    const url = new URL(req.url);
    url.pathname = `/api/v1/products/${encodeURIComponent(detail.redirectTo)}`;
    return NextResponse.json({ data: { redirectTo: detail.redirectTo } }, { status: 308, headers: { Location: url.toString() } });
  }
  const [saved, myReview] = ctx.actor
    ? await Promise.all([isSaved(ctx, "product", detail.product.id), myReviewFor(ctx, "product", detail.product.id)])
    : [false, null];
  return ok({ ...detail, viewer: ctx.actor ? { saved, myReview } : null });
});
