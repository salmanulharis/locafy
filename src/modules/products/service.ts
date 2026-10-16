import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { brands, catalogProducts, categories, productImages, reviews, users } from "@/db/schema";
import type { Ctx } from "@/modules/auth/context";
import { recordEvents } from "@/modules/analytics/service";
import type { LatLng } from "@/modules/geo/geo";
import { candidatesSql } from "@/modules/search/service";

export type SellerOffer = {
  listingId: string;
  shopId: string;
  shopSlug: string;
  shopName: string;
  shopVerified: boolean;
  branchName: string;
  city: string;
  lat: number;
  lng: number;
  distanceM: number | null;
  priceMinor: number;
  mrpMinor: number | null;
  currency: string;
  offerId: string | null;
  offerTitle: string | null;
  effectivePriceMinor: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  stockUpdatedAt: Date;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
  shopRating: number | null;
  shopReviewCount: number;
};

/**
 * Product detail with every seller of THIS exact catalogue product (same
 * brand/model/variant). Other variants are listed separately, never merged.
 */
export async function getProductDetail(ctx: Ctx, slug: string, point: LatLng | null, opts: { track?: boolean } = {}) {
  const db = getDb();
  const rows = await db
    .select({ p: catalogProducts, brand: brands.name, brandSlug: brands.slug, category: categories.name, categorySlug: categories.slug })
    .from(catalogProducts)
    .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
    .leftJoin(categories, eq(categories.id, catalogProducts.categoryId))
    .where(eq(catalogProducts.slug, slug))
    .limit(1);
  const row = rows[0];
  if (!row || row.p.status === "restricted") return null;
  if (row.p.status === "merged" && row.p.mergedIntoId) {
    const target = await db.query.catalogProducts.findFirst({ where: eq(catalogProducts.id, row.p.mergedIntoId) });
    return target ? { redirectTo: target.slug } : null;
  }
  const product = row.p;

  const sellerRows = (await db.execute(sql`
    with c as (${candidatesSql({ q: "", tsq: null, point, radiusM: 0, ignoreRadius: true, inStockOnly: false, offersOnly: false, productIds: [product.id] })})
    select c.*, s.phone, s.whatsapp, l.notes, rt.avg_rating, coalesce(rt.review_count, 0) as review_count
    from c join shops s on s.id = c.shop_id join listings l on l.id = c.listing_id
    left join lateral (
      select round(avg(r.rating)::numeric, 1)::float8 as avg_rating, count(*)::int as review_count
      from reviews r where r.shop_id = c.shop_id and r.target_type = 'shop' and r.status = 'published'
    ) rt on true
    order by (c.stock_status = 'out_of_stock'), ${point ? sql`c.distance_m asc,` : sql``} c.effective_price_minor asc
    limit 50`)) as unknown as Record<string, unknown>[];

  const sellers: SellerOffer[] = sellerRows.map((r) => ({
    listingId: r.listing_id as string,
    shopId: r.shop_id as string,
    shopSlug: r.shop_slug as string,
    shopName: r.shop_name as string,
    shopVerified: Boolean(r.shop_verified),
    branchName: r.branch_name as string,
    city: r.city as string,
    lat: Number(r.lat),
    lng: Number(r.lng),
    distanceM: r.distance_m == null ? null : Number(r.distance_m),
    priceMinor: Number(r.price_minor),
    mrpMinor: r.mrp_minor == null ? null : Number(r.mrp_minor),
    currency: r.currency as string,
    offerId: (r.offer_id as string) ?? null,
    offerTitle: (r.offer_title as string) ?? null,
    effectivePriceMinor: Number(r.effective_price_minor),
    stockStatus: r.stock_status as SellerOffer["stockStatus"],
    stockUpdatedAt: new Date(r.stock_updated_at as string),
    phone: (r.phone as string) ?? null,
    whatsapp: (r.whatsapp as string) ?? null,
    notes: (r.notes as string) ?? null,
    shopRating: r.avg_rating == null ? null : Number(r.avg_rating),
    shopReviewCount: Number(r.review_count ?? 0),
  }));

  const [images, variants, reviewSummary, recentReviews] = await Promise.all([
    db
      .select({ url: productImages.url, alt: productImages.alt })
      .from(productImages)
      .where(
        sql`${productImages.catalogProductId} = ${product.id} or ${productImages.listingId} in
          (select l.id from listings l join shops s on s.id = l.shop_id where l.catalog_product_id = ${product.id} and l.status = 'published' and s.status = 'active')`,
      )
      .orderBy(sql`${productImages.catalogProductId} is null`, asc(productImages.sortOrder))
      .limit(8),
    product.brandId && product.model
      ? db
          .select({ slug: catalogProducts.slug, variant: catalogProducts.variant, name: catalogProducts.name })
          .from(catalogProducts)
          .where(
            and(
              eq(catalogProducts.brandId, product.brandId),
              sql`lower(${catalogProducts.model}) = lower(${product.model})`,
              ne(catalogProducts.id, product.id),
              eq(catalogProducts.status, "active"),
            ),
          )
          .limit(12)
      : Promise.resolve([]),
    db
      .select({ avg: sql<number | null>`round(avg(${reviews.rating})::numeric, 1)::float8`, n: sql<number>`count(*)::int` })
      .from(reviews)
      .where(and(eq(reviews.catalogProductId, product.id), eq(reviews.status, "published"))),
    db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        body: reviews.body,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        authorId: reviews.authorId,
        authorName: users.name,
      })
      .from(reviews)
      .innerJoin(users, eq(users.id, reviews.authorId))
      .where(and(eq(reviews.catalogProductId, product.id), eq(reviews.status, "published")))
      .orderBy(desc(reviews.createdAt))
      .limit(10),
  ]);

  if (opts.track !== false) void recordEvents(
    [
      { type: "product_view", catalogProductId: product.id },
      ...sellers.slice(0, 20).map((s) => ({ type: "listing_view" as const, shopId: s.shopId, listingId: s.listingId, catalogProductId: product.id })),
    ],
    ctx,
  );

  return {
    product: {
      id: product.id,
      slug: product.slug,
      name: product.name,
      model: product.model,
      variant: product.variant,
      description: product.description,
      specs: product.specs,
      gtin: product.gtin,
      brand: row.brand,
      brandSlug: row.brandSlug,
      category: row.category,
      categorySlug: row.categorySlug,
    },
    images,
    sellers,
    variants,
    rating: { average: reviewSummary[0]?.avg ?? null, count: reviewSummary[0]?.n ?? 0 },
    reviews: recentReviews.map((r) => ({ ...r, authorName: publicName(r.authorName) })),
  };
}

/** "Priya Raman" -> "Priya R." for public display. */
export function publicName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Locafy user";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}
