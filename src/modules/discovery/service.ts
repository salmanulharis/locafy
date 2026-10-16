import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { Ctx } from "@/modules/auth/context";
import type { LatLng } from "@/modules/geo/geo";
import { candidatesSql, type SearchHit } from "@/modules/search/service";

type Row = Record<string, unknown>;

function hit(r: Row): SearchHit {
  return {
    listingId: r.listing_id as string,
    productId: r.product_id as string,
    productSlug: r.product_slug as string,
    name: r.name as string,
    brand: (r.brand as string) ?? null,
    model: (r.model as string) ?? null,
    variant: (r.variant as string) ?? null,
    categoryName: (r.category_name as string) ?? null,
    specs: (r.specs as Record<string, string>) ?? {},
    imageUrl: (r.image_url as string) ?? null,
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
    offerPriceMinor: r.offer_price_minor == null ? null : Number(r.offer_price_minor),
    effectivePriceMinor: Number(r.effective_price_minor),
    stockStatus: r.stock_status as SearchHit["stockStatus"],
    stockUpdatedAt: new Date(r.stock_updated_at as string),
    shopRating: null,
    shopReviewCount: 0,
    sponsored: false,
  };
}

const base = (point: LatLng | null, radiusKm: number) => ({
  q: "",
  tsq: null,
  point,
  radiusM: radiusKm * 1000,
  inStockOnly: true,
  offersOnly: false,
});

/** Recently updated, in-stock listings near the selected location (one per product). */
export async function nearbyProducts(point: LatLng | null, radiusKm: number, limit = 8): Promise<SearchHit[]> {
  const rows = (await getDb().execute(sql`
    with c as (${candidatesSql(base(point, radiusKm))}),
    one_per_product as (select distinct on (c.product_id) c.* from c order by c.product_id, c.stock_updated_at desc)
    select * from one_per_product order by ${point ? sql`distance_m asc,` : sql``} stock_updated_at desc limit ${limit}`)) as unknown as Row[];
  return rows.map(hit);
}

/**
 * Products with the most real views in the last 30 days. Returns an empty list
 * until there is enough traffic; nothing is padded or fabricated.
 */
export async function popularProducts(point: LatLng | null, radiusKm: number, limit = 8): Promise<SearchHit[]> {
  const rows = (await getDb().execute(sql`
    with views as (
      select catalog_product_id, count(*) as n from analytics_events
      where type = 'product_view' and created_at > now() - interval '30 days' and catalog_product_id is not null
      group by catalog_product_id having count(*) >= 5
    ),
    c as (${candidatesSql(base(point, radiusKm))}),
    one_per_product as (select distinct on (c.product_id) c.* from c order by c.product_id, c.effective_price_minor asc)
    select o.* from one_per_product o join views v on v.catalog_product_id = o.product_id
    order by v.n desc limit ${limit}`)) as unknown as Row[];
  return rows.map(hit);
}

export type NearbyShop = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  isVerified: boolean;
  categoryName: string | null;
  city: string;
  lat: number;
  lng: number;
  distanceM: number | null;
  productCount: number;
  rating: number | null;
  reviewCount: number;
};

export async function nearbyShops(point: LatLng | null, radiusKm: number, opts: { limit?: number; q?: string; category?: string } = {}): Promise<NearbyShop[]> {
  const pt = point ? sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography` : null;
  const rows = (await getDb().execute(sql`
    select distinct on (s.id) s.id, s.slug, s.name, s.logo_url, s.is_verified, cat.name as category_name, b.city,
      ST_Y(b.location::geometry) as lat, ST_X(b.location::geometry) as lng,
      ${pt ? sql`ST_Distance(b.location, ${pt})` : sql`null::float8`} as distance_m,
      (select count(*)::int from listings l where l.shop_id = s.id and l.status = 'published') as product_count,
      (select round(avg(r.rating)::numeric, 1)::float8 from reviews r where r.shop_id = s.id and r.status = 'published') as rating,
      (select count(*)::int from reviews r where r.shop_id = s.id and r.status = 'published') as review_count
    from shops s
    join branches b on b.shop_id = s.id and b.is_active and b.location is not null
    left join categories cat on cat.id = s.category_id
    where s.status = 'active'
      ${pt ? sql`and ST_DWithin(b.location, ${pt}, ${radiusKm * 1000})` : sql``}
      ${opts.q ? sql`and (lower(s.name) like ${"%" + opts.q.toLowerCase().replace(/[%_]/g, "") + "%"} or lower(s.name) % ${opts.q.toLowerCase()})` : sql``}
      ${opts.category ? sql`and cat.slug = ${opts.category}` : sql``}
    order by s.id, ${pt ? sql`ST_Distance(b.location, ${pt})` : sql`b.is_primary desc`}`)) as unknown as Row[];
  return rows
    .map((r) => ({
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      logoUrl: (r.logo_url as string) ?? null,
      isVerified: Boolean(r.is_verified),
      categoryName: (r.category_name as string) ?? null,
      city: r.city as string,
      lat: Number(r.lat),
      lng: Number(r.lng),
      distanceM: r.distance_m == null ? null : Number(r.distance_m),
      productCount: Number(r.product_count),
      rating: r.rating == null ? null : Number(r.rating),
      reviewCount: Number(r.review_count),
    }))
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity) || b.productCount - a.productCount)
    .slice(0, opts.limit ?? 12);
}

/** Published catalogue of one shop (public shop page). */
export async function shopCatalogue(shopId: string, point: LatLng | null, opts: { limit?: number } = {}) {
  const rows = (await getDb().execute(sql`
    with c as (${candidatesSql({ ...base(point, 0), inStockOnly: false, ignoreRadius: true })})
    select * from c where c.shop_id = ${shopId}
    order by (c.stock_status = 'out_of_stock'), c.name limit ${opts.limit ?? 60}`)) as unknown as Row[];
  return rows.map(hit);
}

export async function recordShopView(ctx: Ctx, shopId: string) {
  const { recordEvents } = await import("@/modules/analytics/service");
  void recordEvents([{ type: "shop_view", shopId }], ctx);
}
