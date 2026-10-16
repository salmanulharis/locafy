import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { searchLogs, searchSynonyms } from "@/db/schema";
import { uuidArray } from "@/lib/sql";
import { moneySchema, parseInput } from "@/lib/validation";
import type { Ctx } from "@/modules/auth/context";
import { DEFAULT_RADIUS_KM, type LatLng } from "@/modules/geo/geo";
import { STALE_AFTER_DAYS, FRESH_WITHIN_DAYS } from "@/modules/inventory/rules";
import { enforceRateLimit } from "@/modules/platform/rate-limit";
import { recordEvents } from "@/modules/analytics/service";
import { buildTsQuery, FUZZY_THRESHOLD, normaliseQuery, tokenize, type MatchMode, type SynonymMap } from "./query";

export const searchInputSchema = z.object({
  q: z.string().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(200).default(DEFAULT_RADIUS_KM),
  category: z.string().max(80).optional(),
  brand: z.string().max(80).optional(),
  minPrice: moneySchema.optional(),
  maxPrice: moneySchema.optional(),
  availability: z.enum(["any", "in_stock"]).default("any"),
  // Not z.coerce.boolean(): query strings arrive as text and Boolean("false") is true.
  offers: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0", "on", "off", ""])])
    .transform((v) => v === true || v === "true" || v === "1" || v === "on")
    .optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(["relevance", "price", "distance", "rating"]).default("relevance"),
  page: z.coerce.number().int().min(1).max(50).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchInput = z.input<typeof searchInputSchema>;

export type SearchHit = {
  listingId: string;
  productId: string;
  productSlug: string;
  name: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  categoryName: string | null;
  specs: Record<string, string>;
  imageUrl: string | null;
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
  offerPriceMinor: number | null;
  effectivePriceMinor: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  stockUpdatedAt: Date;
  shopRating: number | null;
  shopReviewCount: number;
  sponsored: boolean;
};

export type SearchResult = {
  query: string;
  items: SearchHit[];
  sponsored: SearchHit | null;
  total: number;
  page: number;
  pageSize: number;
  hasLocation: boolean;
  radiusKm: number;
  /** Shown only when there are no exact matches; never mixed into `items`. */
  alternatives: SearchHit[];
  /** True when the product exists in Locafy but no shop within the radius stocks it. */
  existsOutsideRadius: boolean;
  /** How the text matched: all words, some words, or similar spellings. */
  matchMode: MatchMode;
  tookMs: number;
};

let synonymCache: { at: number; map: SynonymMap } | null = null;

async function loadSynonyms(): Promise<SynonymMap> {
  if (synonymCache && Date.now() - synonymCache.at < 60_000) return synonymCache.map;
  const rows = await getDb().select().from(searchSynonyms);
  const map: SynonymMap = new Map();
  for (const r of rows) {
    const group = [r.term, ...r.synonyms].map((s) => s.toLowerCase());
    for (const w of group) {
      if (w.includes(" ")) continue;
      const set = new Set(map.get(w) ?? []);
      for (const other of group) if (other !== w) set.add(other);
      map.set(w, [...set]);
    }
  }
  synonymCache = { at: Date.now(), map };
  return map;
}

export function clearSynonymCache() {
  synonymCache = null;
}

export type Filters = {
  q: string;
  /** tsquery used for relevance ranking (exact/partial modes). */
  tsq: string | null;
  /** Raw query used for trigram relevance (fuzzy mode). */
  fuzzyQ?: string | null;
  point: LatLng | null;
  radiusM: number;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly: boolean;
  offersOnly: boolean;
  minRating?: number;
  ignoreRadius?: boolean;
  productIds?: string[];
  excludeProductIds?: string[];
};

/**
 * Candidate SQL: one row per published listing (best branch = nearest within
 * the radius, or cheapest when no location is set) with offer-adjusted price,
 * availability and a composite relevance score.
 */
export function candidatesSql(f: Filters): SQL {
  const pt = f.point ? sql`ST_SetSRID(ST_MakePoint(${f.point.lng}, ${f.point.lat}), 4326)::geography` : null;
  const tsq = f.tsq ? sql`to_tsquery('english', ${f.tsq})` : null;

  // Text matching is resolved beforehand into `productIds` (see resolveMatch);
  // here the query only contributes to relevance ranking.
  const relevance = tsq
    ? sql`ts_rank(cp.search_vector, ${tsq}, 32) * 2`
    : f.fuzzyQ
      ? sql`word_similarity(${f.fuzzyQ}, cp.search_text)`
      : sql`0.5`;

  const conds: SQL[] = [sql`l.status = 'published'`, sql`s.status = 'active'`, sql`cp.status = 'active'`];
  if (f.category) {
    conds.push(sql`cp.category_id in (select c.id from categories c where c.slug = ${f.category}
      union select c2.id from categories c2 join categories p on p.id = c2.parent_id where p.slug = ${f.category})`);
  }
  if (f.brand) conds.push(sql`br.slug = ${f.brand}`);
  if (f.productIds) conds.push(sql`cp.id = any(${uuidArray(f.productIds)})`);
  if (f.excludeProductIds?.length) conds.push(sql`cp.id <> all(${uuidArray(f.excludeProductIds)})`);

  const branchConds: SQL[] = [sql`b.is_active`, sql`b.location is not null`];
  if (pt && !f.ignoreRadius) branchConds.push(sql`ST_DWithin(b.location, ${pt}, ${f.radiusM})`);
  if (f.inStockOnly) branchConds.push(sql`i.stock_status in ('in_stock','low_stock')`);

  const distance = pt ? sql`ST_Distance(b.location, ${pt})` : sql`null::float8`;

  return sql`
    select distinct on (l.id)
      l.id as listing_id, cp.id as product_id, cp.slug as product_slug, cp.name, br.name as brand, br.slug as brand_slug,
      cp.model, cp.variant, cat.name as category_name, cp.specs,
      (select pi.url from product_images pi where pi.catalog_product_id = cp.id or pi.listing_id = l.id
         order by (pi.catalog_product_id is null), pi.sort_order limit 1) as image_url,
      s.id as shop_id, s.slug as shop_slug, s.name as shop_name, s.is_verified as shop_verified,
      b.name as branch_name, b.city, ST_Y(b.location::geometry) as lat, ST_X(b.location::geometry) as lng,
      ${distance} as distance_m,
      i.price_minor, i.mrp_minor, i.currency, i.stock_status, i.stock_updated_at,
      ofr.id as offer_id, ofr.title as offer_title, ofr.offer_price as offer_price_minor,
      coalesce(ofr.offer_price, i.price_minor) as effective_price_minor,
      ${relevance} as relevance
    from listings l
    join shops s on s.id = l.shop_id
    join catalog_products cp on cp.id = l.catalog_product_id
    left join brands br on br.id = cp.brand_id
    left join categories cat on cat.id = cp.category_id
    join inventory i on i.listing_id = l.id
    join branches b on b.id = i.branch_id
    left join lateral (
      select o.id, o.title,
        least(i.price_minor, greatest(1, case o.discount_type
          when 'percent' then round(i.price_minor * (1 - o.discount_value / 100.0))::int
          when 'amount_off' then i.price_minor - o.discount_value
          else o.discount_value end)) as offer_price
      from offer_listings ol join offers o on o.id = ol.offer_id
      where ol.listing_id = l.id and o.status = 'published' and o.starts_at <= now() and o.ends_at > now()
      order by offer_price asc limit 1
    ) ofr on true
    where ${sql.join(conds, sql` and `)} and ${sql.join(branchConds, sql` and `)}
    order by l.id, ${pt ? sql`${distance} asc,` : sql``} coalesce(ofr.offer_price, i.price_minor) asc
  `;
}

function rankedSql(f: Filters, sort: string): SQL {
  const conds: SQL[] = [sql`true`];
  if (f.minPrice !== undefined) conds.push(sql`c.effective_price_minor >= ${f.minPrice}`);
  if (f.maxPrice !== undefined) conds.push(sql`c.effective_price_minor <= ${f.maxPrice}`);
  if (f.offersOnly) conds.push(sql`c.offer_id is not null`);
  if (f.minRating !== undefined) conds.push(sql`coalesce(rt.avg_rating, 0) >= ${f.minRating}`);

  // Composite "best match": relevance first, then availability confidence,
  // proximity, freshness and (lightly) seller rating. See docs/search.md.
  const availability = sql`(case c.stock_status when 'in_stock' then 1 when 'low_stock' then 0.8 when 'unknown' then 0.35 else 0 end)
    * (case when c.stock_updated_at > now() - make_interval(days => ${FRESH_WITHIN_DAYS}) then 1
            when c.stock_updated_at > now() - make_interval(days => ${STALE_AFTER_DAYS}) then 0.85 else 0.5 end)`;
  const proximity = sql`(case when c.distance_m is null then 0.5 else 1.0 / (1 + c.distance_m / 3000.0) end)`;
  const ratingScore = sql`(coalesce(rt.avg_rating, 3) / 5.0)`;
  const score = sql`(0.55 * least(c.relevance, 1) + 0.25 * ${availability} + 0.15 * ${proximity} + 0.05 * ${ratingScore})`;

  const order =
    sort === "price"
      ? sql`c.effective_price_minor asc, ${score} desc`
      : sort === "distance"
        ? sql`c.distance_m asc nulls last, ${score} desc`
        : sort === "rating"
          ? sql`rt.avg_rating desc nulls last, rt.review_count desc, ${score} desc`
          : sql`${score} desc, c.effective_price_minor asc`;

  return sql`
    with c as (${candidatesSql(f)})
    select c.*, rt.avg_rating, coalesce(rt.review_count, 0) as review_count,
      exists (select 1 from sponsored_placements sp where sp.listing_id = c.listing_id and sp.is_active
              and sp.starts_at <= now() and sp.ends_at > now()) as sponsored,
      ${score} as score,
      count(*) over () as total_count
    from c
    left join lateral (
      select round(avg(r.rating)::numeric, 1)::float8 as avg_rating, count(*)::int as review_count
      from reviews r where r.shop_id = c.shop_id and r.target_type = 'shop' and r.status = 'published'
    ) rt on true
    where ${sql.join(conds, sql` and `)}
    order by ${order}
  `;
}

type Row = Record<string, unknown>;

function mapRow(r: Row): SearchHit {
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
    shopRating: r.avg_rating == null ? null : Number(r.avg_rating),
    shopReviewCount: Number(r.review_count ?? 0),
    sponsored: Boolean(r.sponsored),
  };
}

export async function searchProducts(ctx: Ctx, input: unknown): Promise<SearchResult> {
  const started = performance.now();
  const p = parseInput(searchInputSchema, input ?? {});
  await enforceRateLimit("search", ctx.ip);
  const q = normaliseQuery(p.q);
  const point = p.lat !== undefined && p.lng !== undefined && !(p.lat === 0 && p.lng === 0) ? { lat: p.lat, lng: p.lng } : null;
  const sort = p.sort === "distance" && !point ? "relevance" : p.sort;
  const match = q ? await resolveMatch(q) : { mode: "browse" as const, ids: undefined, tsq: null, fuzzyQ: null };
  const filters: Filters = {
    q,
    tsq: match.tsq,
    fuzzyQ: match.fuzzyQ,
    productIds: match.ids,
    point,
    radiusM: p.radiusKm * 1000,
    category: p.category,
    brand: p.brand,
    minPrice: p.minPrice,
    maxPrice: p.maxPrice,
    inStockOnly: p.availability === "in_stock",
    offersOnly: Boolean(p.offers),
    minRating: p.minRating,
  };
  const db = getDb();
  const rows = (await db.execute(
    sql`${rankedSql(filters, sort)} limit ${p.pageSize} offset ${(p.page - 1) * p.pageSize}`,
  )) as unknown as Row[];
  const items = rows.map(mapRow);
  const total = rows[0] ? Number(rows[0].total_count) : 0;

  // Sponsored slot: at most one, must satisfy the same query and filters, and is labelled in the UI.
  let sponsored: SearchHit | null = null;
  if (p.page === 1 && total > 0) {
    const sp = (await db.execute(
      sql`select * from (${rankedSql(filters, "relevance")}) x where x.sponsored limit 1`,
    )) as unknown as Row[];
    sponsored = sp[0] ? mapRow(sp[0]) : null;
  }

  let alternatives: SearchHit[] = [];
  let existsOutsideRadius = false;
  if (total === 0 && q) {
    const exact = filters.productIds?.length
      ? ((await db.execute(sql`select c.product_id, c.listing_id from (${candidatesSql({ ...filters, ignoreRadius: true })}) c limit 50`)) as unknown as Row[])
      : [];
    existsOutsideRadius = Boolean(point) && exact.length > 0;
    alternatives = await findAlternatives(filters, exact.map((r) => r.product_id as string));
  }

  const tookMs = Math.round(performance.now() - started);
  void logSearch(q, total, tookMs, Boolean(point));
  if (items.length) {
    void recordEvents(
      items.map((h) => ({ type: "product_impression" as const, shopId: h.shopId, listingId: h.listingId, catalogProductId: h.productId })),
      ctx,
    );
  }
  return {
    query: q,
    items,
    sponsored,
    total,
    page: p.page,
    pageSize: p.pageSize,
    hasLocation: Boolean(point),
    radiusKm: p.radiusKm,
    alternatives,
    existsOutsideRadius,
    matchMode: match.mode,
    tookMs,
  };
}

/**
 * Staged text matching over the catalogue (location-independent):
 *  1. exact   - every word (or a synonym) matches; last word as prefix
 *  2. partial - any word matches (multi-word queries only), ranked by coverage
 *  3. fuzzy   - similar spelling via trigram word similarity
 * The first stage that finds catalogue products wins, so typo tolerance never
 * pollutes results when an exact match exists (e.g. "atta" vs "matta").
 */
async function resolveMatch(q: string): Promise<{ mode: MatchMode; ids: string[]; tsq: string | null; fuzzyQ: string | null }> {
  const db = getDb();
  const synonyms = await loadSynonyms();
  const ids = async (cond: SQL) =>
    ((await db.execute(sql`select id from catalog_products cp where cp.status = 'active' and ${cond} limit 2000`)) as unknown as Row[]).map(
      (r) => r.id as string,
    );
  const strict = buildTsQuery(q, synonyms, "and");
  if (strict) {
    const found = await ids(sql`cp.search_vector @@ to_tsquery('english', ${strict})`);
    if (found.length) return { mode: "exact", ids: found, tsq: strict, fuzzyQ: null };
    const relaxed = buildTsQuery(q, synonyms, "or");
    if (relaxed && relaxed !== strict) {
      const some = await ids(sql`cp.search_vector @@ to_tsquery('english', ${relaxed})`);
      if (some.length) return { mode: "partial", ids: some, tsq: relaxed, fuzzyQ: null };
    }
  }
  const lower = q.toLowerCase();
  const fuzzy = await ids(sql`word_similarity(${lower}, cp.search_text) >= ${FUZZY_THRESHOLD}`);
  return { mode: "fuzzy", ids: fuzzy, tsq: null, fuzzyQ: lower };
}

/**
 * When nothing matches nearby: suggest products from the same categories as
 * the closest text matches (or looser token matches), clearly labelled as
 * alternatives rather than exact matches.
 */
async function findAlternatives(f: Filters, exactProductIds: string[]): Promise<SearchHit[]> {
  const db = getDb();
  const tokens = tokenize(f.q).filter((t) => t.length >= 3);
  const catRows = (await db.execute(sql`
    select distinct cp.category_id from catalog_products cp
    where cp.status = 'active' and cp.category_id is not null and (
      ${exactProductIds.length ? sql`cp.id = any(${uuidArray(exactProductIds)}) or` : sql``}
      ${tokens.length ? sql`cp.search_vector @@ to_tsquery('english', ${tokens.join(" | ")}) or` : sql``}
      word_similarity(${f.q}, cp.search_text) > 0.3)
    limit 5`)) as unknown as Row[];
  const categoryIds = catRows.map((r) => r.category_id as string);
  if (!categoryIds.length) return [];
  const rows = (await db.execute(sql`
    with c as (${candidatesSql({ ...f, q: "", tsq: null, fuzzyQ: null, productIds: undefined, category: undefined, brand: undefined, excludeProductIds: exactProductIds })})
    select c.*, null::float8 as avg_rating, 0 as review_count, false as sponsored from c
    where c.product_id in (select id from catalog_products where category_id = any(${uuidArray(categoryIds)}))
    order by c.distance_m asc nulls last, c.effective_price_minor asc limit 8`)) as unknown as Row[];
  return rows.map(mapRow);
}

async function logSearch(query: string, resultCount: number, durationMs: number, hadLocation: boolean) {
  if (!query) return;
  try {
    await getDb().insert(searchLogs).values({ query: query.toLowerCase(), resultCount, durationMs, hadLocation });
  } catch {
    // Non-critical.
  }
}

/** Lightweight autocomplete over catalogue names, brands and categories. */
export async function suggest(q: string) {
  const term = normaliseQuery(q).toLowerCase();
  if (term.length < 2) return { products: [], categories: [] };
  const db = getDb();
  const tsq = buildTsQuery(term, await loadSynonyms());
  const [products, cats] = await Promise.all([
    db.execute(sql`
      select cp.slug, cp.name, br.name as brand, cp.variant
      from catalog_products cp left join brands br on br.id = cp.brand_id
      where cp.status = 'active'
        and exists (select 1 from listings l join shops s on s.id = l.shop_id where l.catalog_product_id = cp.id and l.status = 'published' and s.status = 'active')
        and (${tsq ? sql`cp.search_vector @@ to_tsquery('english', ${tsq}) or` : sql``} word_similarity(${term}, cp.search_text) >= 0.6)
      order by word_similarity(${term}, cp.search_text) desc, cp.name
      limit 6`),
    db.execute(sql`
      select slug, name from categories
      where is_active and (lower(name) like ${term + "%"} or lower(name) % ${term})
      order by similarity(lower(name), ${term}) desc limit 3`),
  ]);
  return {
    products: (products as unknown as Row[]).map((r) => ({
      slug: r.slug as string,
      name: r.name as string,
      brand: (r.brand as string) ?? null,
      variant: (r.variant as string) ?? null,
    })),
    categories: (cats as unknown as Row[]).map((r) => ({ slug: r.slug as string, name: r.name as string })),
  };
}

