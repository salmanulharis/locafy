import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/db/client";
import { catalogProducts, listings, offerListings, offers } from "@/db/schema";
import { errors } from "@/lib/errors";
import { uuidArray } from "@/lib/sql";
import { moneySchema, parseInput, uuidSchema } from "@/lib/validation";
import { requireShopPermission } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import type { LatLng } from "@/modules/geo/geo";
import { audit } from "@/modules/platform/audit";
import { assertFeature, assertWithinLimit } from "@/modules/subscriptions/entitlements";
import { offerPhase, validateDiscount, validateOfferWindow, type DiscountType } from "./rules";

const offerSchema = z
  .object({
    title: z.string().trim().min(3, "Give the offer a short title.").max(80),
    description: z.string().trim().max(500).optional(),
    conditions: z.string().trim().max(500).optional(),
    discountType: z.enum(["percent", "amount_off", "fixed_price"]),
    /** percent: whole number; amounts: major units (converted to minor). */
    discountValue: z.union([z.string(), z.number()]),
    startsAt: z.coerce.date({ message: "Enter a valid start date." }),
    endsAt: z.coerce.date({ message: "Enter a valid end date." }),
    listingIds: z.array(uuidSchema).min(1, "Select at least one product.").max(200),
  })
  .transform((v, ctx) => {
    let value: number;
    if (v.discountType === "percent") {
      value = Number(v.discountValue);
    } else {
      const parsed = moneySchema.safeParse(v.discountValue);
      if (!parsed.success) {
        ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Enter a valid amount." });
        return z.NEVER;
      }
      value = parsed.data;
    }
    const issue = validateDiscount(v.discountType, value);
    if (issue) {
      ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
      return z.NEVER;
    }
    return { ...v, discountValue: value, listingIds: [...new Set(v.listingIds)] };
  });

async function assertListingsBelong(tx: Tx, shopId: string, ids: string[]) {
  const rows = await tx
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.shopId, shopId), inArray(listings.id, ids)));
  if (rows.length !== new Set(ids).size) throw errors.validation("One or more selected products are not part of this shop.");
}

/**
 * Offers that are fixed_price or amount_off must still be a real discount on
 * every selected listing (cannot raise a price or exceed it).
 */
async function assertDiscountValid(tx: Tx, type: DiscountType, value: number, listingIds: string[]) {
  if (type === "percent") return;
  const rows = (await tx.execute(sql`
    select min(i.price_minor)::int as min_price from inventory i where i.listing_id = any(${uuidArray(listingIds)})`)) as unknown as {
    min_price: number | null;
  }[];
  const min = rows[0]?.min_price;
  if (min == null) return;
  if (type === "fixed_price" && value >= min) {
    throw errors.validation("The offer price must be lower than the current price of every selected product.", {
      discountValue: ["Must be lower than the current price of every selected product."],
    });
  }
  if (type === "amount_off" && value >= min) {
    throw errors.validation("The discount is larger than the price of a selected product.", {
      discountValue: ["Discount must be smaller than every selected product's price."],
    });
  }
}

export async function createOffer(ctx: Ctx, shopId: string, input: unknown, publish = false) {
  const { user, shop } = await requireShopPermission(ctx, shopId, "offer.manage");
  if (shop.status === "suspended") throw errors.invalidState("This shop is suspended.");
  const data = parseInput(offerSchema, input);
  const issues = validateOfferWindow(data.startsAt, data.endsAt);
  if (issues.length) throw errors.validation(issues[0]!.message, Object.fromEntries(issues.map((i) => [i.field, [i.message]])));
  const db = getDb();
  return db.transaction(async (tx) => {
    await assertListingsBelong(tx, shopId, data.listingIds);
    await assertDiscountValid(tx, data.discountType, data.discountValue, data.listingIds);
    if (data.startsAt.getTime() > Date.now() + 60_000) {
      await assertFeature(tx, shopId, "promotionScheduling", "Scheduling offers in advance");
    }
    if (publish) {
      if (shop.status !== "active") throw errors.invalidState("Your shop must be approved before offers can be published.");
      await assertWithinLimit(tx, shopId, "maxActiveOffers");
    }
    const [offer] = await tx
      .insert(offers)
      .values({
        shopId,
        title: data.title,
        description: data.description ?? null,
        conditions: data.conditions ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: publish ? "published" : "draft",
        createdBy: user.id,
      })
      .returning();
    await tx.insert(offerListings).values(data.listingIds.map((listingId) => ({ offerId: offer!.id, listingId })));
    await audit(tx, ctx, { action: "offer.create", targetType: "offer", targetId: offer!.id, metadata: { publish } });
    return offer!;
  });
}

async function loadOffer(ctx: Ctx, offerId: string, tx: Tx) {
  parseInput(uuidSchema, offerId);
  const offer = await tx.query.offers.findFirst({ where: eq(offers.id, offerId) });
  if (!offer) throw errors.notFound("Offer");
  const access = await requireShopPermission(ctx, offer.shopId, "offer.manage", tx);
  return { offer, ...access };
}

export async function updateOffer(ctx: Ctx, offerId: string, input: unknown) {
  const data = parseInput(offerSchema, input);
  const issues = validateOfferWindow(data.startsAt, data.endsAt);
  if (issues.length) throw errors.validation(issues[0]!.message, Object.fromEntries(issues.map((i) => [i.field, [i.message]])));
  const db = getDb();
  await db.transaction(async (tx) => {
    const { offer, shop } = await loadOffer(ctx, offerId, tx);
    if (shop.status === "suspended") throw errors.invalidState("This shop is suspended.");
    await assertListingsBelong(tx, offer.shopId, data.listingIds);
    await assertDiscountValid(tx, data.discountType, data.discountValue, data.listingIds);
    // Same entitlement as createOffer: moving the start into the future is scheduling.
    if (data.startsAt.getTime() > Date.now() + 60_000 && data.startsAt.getTime() !== offer.startsAt.getTime()) {
      await assertFeature(tx, offer.shopId, "promotionScheduling", "Scheduling offers in advance");
    }
    await tx
      .update(offers)
      .set({
        title: data.title,
        description: data.description ?? null,
        conditions: data.conditions ?? null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        updatedAt: new Date(),
      })
      .where(eq(offers.id, offerId));
    await tx.delete(offerListings).where(eq(offerListings.offerId, offerId));
    await tx.insert(offerListings).values(data.listingIds.map((listingId) => ({ offerId, listingId })));
    await audit(tx, ctx, { action: "offer.update", targetType: "offer", targetId: offerId });
  });
}

export async function setOfferPublished(ctx: Ctx, offerId: string, published: boolean) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const { offer, shop } = await loadOffer(ctx, offerId, tx);
    if (published) {
      if (shop.status !== "active") throw errors.invalidState("Your shop must be approved before offers can be published.");
      if (offer.endsAt <= new Date()) throw errors.invalidState("This offer has already ended. Change the end date first.");
      if (offer.status !== "published") await assertWithinLimit(tx, offer.shopId, "maxActiveOffers");
    }
    await tx
      .update(offers)
      .set({ status: published ? "published" : "unpublished", updatedAt: new Date() })
      .where(eq(offers.id, offerId));
    await audit(tx, ctx, { action: published ? "offer.publish" : "offer.unpublish", targetType: "offer", targetId: offerId });
  });
}

export async function listShopOffers(ctx: Ctx, shopId: string) {
  await requireShopPermission(ctx, shopId, "shop.view");
  const rows = await getDb()
    .select({
      offer: offers,
      listingCount: sql<number>`(select count(*)::int from offer_listings ol where ol.offer_id = ${offers.id})`,
    })
    .from(offers)
    .where(eq(offers.shopId, shopId))
    .orderBy(desc(offers.createdAt));
  const now = new Date();
  return rows.map((r) => ({ ...r.offer, listingCount: r.listingCount, phase: offerPhase(r.offer, now) }));
}

export async function getShopOffer(ctx: Ctx, offerId: string) {
  const db = getDb();
  const { offer } = await loadOffer(ctx, offerId, db);
  const linked = await db.select({ listingId: offerListings.listingId }).from(offerListings).where(eq(offerListings.offerId, offerId));
  return { ...offer, listingIds: linked.map((l) => l.listingId), phase: offerPhase(offer) };
}

/** Public: currently active offers near a point (or everywhere when no point). */
export async function listActiveOffers(opts: { point?: LatLng | null; radiusKm?: number; shopId?: string; limit?: number }) {
  const pt = opts.point ? sql`ST_SetSRID(ST_MakePoint(${opts.point.lng}, ${opts.point.lat}), 4326)::geography` : null;
  const rows = (await getDb().execute(sql`
    select o.id, o.title, o.description, o.conditions, o.discount_type, o.discount_value, o.starts_at, o.ends_at,
      s.id as shop_id, s.slug as shop_slug, s.name as shop_name, s.logo_url,
      ${pt ? sql`(select min(ST_Distance(b.location, ${pt})) from branches b where b.shop_id = s.id and b.is_active and b.location is not null)` : sql`null::float8`} as distance_m,
      (select json_agg(json_build_object('slug', cp.slug, 'name', cp.name, 'variant', cp.variant) order by cp.name)
         from offer_listings ol join listings l on l.id = ol.listing_id join catalog_products cp on cp.id = l.catalog_product_id
         where ol.offer_id = o.id and l.status = 'published') as products
    from offers o join shops s on s.id = o.shop_id
    where o.status = 'published' and o.starts_at <= now() and o.ends_at > now() and s.status = 'active'
      ${opts.shopId ? sql`and s.id = ${opts.shopId}` : sql``}
      ${pt ? sql`and exists (select 1 from branches b where b.shop_id = s.id and b.is_active and ST_DWithin(b.location, ${pt}, ${(opts.radiusKm ?? 25) * 1000}))` : sql``}
      and exists (select 1 from offer_listings ol join listings l on l.id = ol.listing_id where ol.offer_id = o.id and l.status = 'published')
    order by ${pt ? sql`distance_m asc nulls last,` : sql``} o.ends_at asc
    limit ${opts.limit ?? 12}`)) as unknown as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    conditions: (r.conditions as string) ?? null,
    discountType: r.discount_type as DiscountType,
    discountValue: Number(r.discount_value),
    startsAt: new Date(r.starts_at as string),
    endsAt: new Date(r.ends_at as string),
    shopId: r.shop_id as string,
    shopSlug: r.shop_slug as string,
    shopName: r.shop_name as string,
    logoUrl: (r.logo_url as string) ?? null,
    distanceM: r.distance_m == null ? null : Number(r.distance_m),
    products: ((r.products as { slug: string; name: string; variant: string | null }[]) ?? []).slice(0, 6),
  }));
}

/** Listings available for offer selection in the merchant UI. */
export async function offerableListings(ctx: Ctx, shopId: string) {
  await requireShopPermission(ctx, shopId, "offer.manage");
  return getDb()
    .select({ id: listings.id, name: catalogProducts.name, variant: catalogProducts.variant, status: listings.status })
    .from(listings)
    .innerJoin(catalogProducts, eq(catalogProducts.id, listings.catalogProductId))
    .where(and(eq(listings.shopId, shopId), inArray(listings.status, ["draft", "published", "unpublished"])))
    .orderBy(catalogProducts.name);
}

