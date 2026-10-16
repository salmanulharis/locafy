import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/db/client";
import {
  branches,
  brands,
  catalogProducts,
  categories,
  inventory,
  inventoryHistory,
  listings,
  productImages,
  shops,
} from "@/db/schema";
import { errors, isUniqueViolation } from "@/lib/errors";
import { moneySchema, pageSchema, parseInput, uuidSchema } from "@/lib/validation";
import { requireShopPermission, type ShopPermission } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import {
  canMerchantEditCatalog,
  catalogInputSchema,
  resolveCatalogProduct,
  updateCatalogProduct,
} from "@/modules/catalog/service";
import { audit } from "@/modules/platform/audit";
import { assertWithinLimit } from "@/modules/subscriptions/entitlements";
import { deriveStockStatus, STALE_AFTER_DAYS, STOCK_STATUSES_INPUT } from "@/modules/inventory/rules";
import { nextListingStatus, publishBlockers, type ListingAction, type ListingStatus } from "./rules";

const stockInputSchema = z
  .object({
    branchId: uuidSchema,
    price: moneySchema,
    mrp: moneySchema.optional(),
    quantity: z.coerce.number().int("Use a whole number.").min(0, "Stock cannot be negative.").max(1_000_000).optional(),
    stockStatus: z.enum(STOCK_STATUSES_INPUT).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .refine((v) => v.mrp === undefined || v.mrp >= v.price, { message: "MRP cannot be lower than the selling price.", path: ["mrp"] })
  .refine((v) => v.price > 0, { message: "Price must be greater than zero.", path: ["price"] });

export const createListingSchema = z
  .object({
    catalogProductId: uuidSchema.optional(),
    product: catalogInputSchema.optional(),
    notes: z.string().trim().max(1000).optional(),
    stock: z
      .array(stockInputSchema)
      .min(1, "Add a price for at least one branch.")
      .max(50)
      .refine((s) => new Set(s.map((x) => x.branchId)).size === s.length, "Each branch can only be priced once."),
    publish: z.boolean().default(false),
  })
  .refine((v) => Boolean(v.catalogProductId) !== Boolean(v.product), {
    message: "Choose an existing product or describe a new one.",
    path: ["product"],
  });

/** Load a listing and enforce shop permission. Non-members get NOT_FOUND. */
export async function loadListing(ctx: Ctx, listingId: string, permission: ShopPermission, tx: Tx = getDb()) {
  parseInput(uuidSchema, listingId);
  const row = await tx.query.listings.findFirst({ where: eq(listings.id, listingId) });
  if (!row) throw errors.notFound("Listing");
  const access = await requireShopPermission(ctx, row.shopId, permission, tx);
  return { listing: row, ...access };
}

function assertShopOperational(status: string) {
  if (status === "suspended") throw errors.invalidState("This shop is suspended. Product changes are disabled.");
}

async function assertBranchesBelong(tx: Tx, shopId: string, branchIds: string[]) {
  const rows = await tx
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.shopId, shopId), inArray(branches.id, branchIds)));
  if (rows.length !== new Set(branchIds).size) throw errors.validation("One of the branches is not part of this shop.");
}

export async function createListing(ctx: Ctx, shopId: string, input: unknown) {
  const { user, shop } = await requireShopPermission(ctx, shopId, "listing.manage");
  assertShopOperational(shop.status);
  const data = parseInput(createListingSchema, input);
  const db = getDb();
  return db.transaction(async (tx) => {
    await assertWithinLimit(tx, shopId, "maxListings");
    await assertBranchesBelong(tx, shopId, data.stock.map((s) => s.branchId));

    let productId: string;
    if (data.catalogProductId) {
      const p = await tx.query.catalogProducts.findFirst({ where: eq(catalogProducts.id, data.catalogProductId) });
      if (!p || p.status === "merged") throw errors.notFound("Catalogue product");
      if (p.status === "restricted") throw errors.forbidden("This product is restricted on Locafy and cannot be listed.");
      productId = p.id;
    } else {
      productId = (await resolveCatalogProduct(tx, user.id, data.product!)).product.id;
    }

    let listingId: string;
    try {
      const [l] = await tx
        .insert(listings)
        .values({ shopId, catalogProductId: productId, notes: data.notes ?? null, createdBy: user.id })
        .returning({ id: listings.id });
      listingId = l!.id;
    } catch (e) {
      if (isUniqueViolation(e, "listings_shop_product_key")) {
        throw errors.conflict("Your shop already lists this product. Edit the existing listing instead.");
      }
      throw e;
    }

    const currency = process.env.DEFAULT_CURRENCY ?? "INR";
    for (const s of data.stock) {
      const threshold = s.lowStockThreshold ?? 3;
      const quantity = s.quantity ?? null;
      const status = deriveStockStatus(quantity, threshold, s.stockStatus);
      const [inv] = await tx
        .insert(inventory)
        .values({
          listingId,
          branchId: s.branchId,
          priceMinor: s.price,
          mrpMinor: s.mrp ?? null,
          currency,
          quantity,
          stockStatus: status,
          lowStockThreshold: threshold,
        })
        .returning({ id: inventory.id });
      await tx.insert(inventoryHistory).values({
        inventoryId: inv!.id,
        changedBy: user.id,
        newPriceMinor: s.price,
        newQuantity: quantity,
        newStockStatus: status,
      });
    }

    if (data.publish) await publishInTx(tx, listingId);
    await audit(tx, ctx, { action: "listing.create", targetType: "listing", targetId: listingId });
    return { id: listingId, catalogProductId: productId };
  });
}

async function publishInTx(tx: Tx, listingId: string) {
  const rows = await tx
    .select({
      listingStatus: listings.status,
      shopStatus: shops.status,
      catalogStatus: catalogProducts.status,
      priced: sql<number>`(select count(*)::int from inventory i join branches b on b.id = i.branch_id
              where i.listing_id = ${listings.id} and b.is_active and b.location is not null)`,
    })
    .from(listings)
    .innerJoin(shops, eq(shops.id, listings.shopId))
    .innerJoin(catalogProducts, eq(catalogProducts.id, listings.catalogProductId))
    .where(eq(listings.id, listingId))
    .for("update", { of: listings });
  const r = rows[0]!;
  const blockers = publishBlockers({
    shopStatus: r.shopStatus,
    catalogStatus: r.catalogStatus,
    listingStatus: r.listingStatus,
    pricedLocatedBranches: r.priced,
  });
  if (blockers.length) throw errors.invalidState(blockers.join(" "));
  const next = r.listingStatus === "published" ? "published" : nextListingStatus(r.listingStatus, "publish");
  if (!next) throw errors.invalidState(`A ${r.listingStatus} listing cannot be published directly.`);
  await tx
    .update(listings)
    .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
    .where(eq(listings.id, listingId));
}

export async function changeListingStatus(ctx: Ctx, listingId: string, action: ListingAction) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { listing, shop } = await loadListing(ctx, listingId, "listing.manage", tx);
    assertShopOperational(shop.status);
    if (action === "publish") {
      await publishInTx(tx, listingId);
    } else {
      const next = nextListingStatus(listing.status as ListingStatus, action);
      if (!next) throw errors.invalidState(`You cannot ${action} a ${listing.status} listing.`);
      if (action === "restore") await assertWithinLimit(tx, listing.shopId, "maxListings");
      await tx.update(listings).set({ status: next, updatedAt: new Date() }).where(eq(listings.id, listingId));
    }
    await audit(tx, ctx, { action: `listing.${action}`, targetType: "listing", targetId: listingId });
  });
}

const updateListingSchema = z.object({
  notes: z.string().trim().max(1000).optional(),
  product: catalogInputSchema.optional(),
});

/** Update shop-specific notes and, when permitted, the merchant-owned catalogue entry. */
export async function updateListing(ctx: Ctx, listingId: string, input: unknown) {
  const data = parseInput(updateListingSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const { listing, user, shop } = await loadListing(ctx, listingId, "listing.manage", tx);
    assertShopOperational(shop.status);
    // Only touch notes when the caller sent the field (form submissions always do; API patches may not).
    const hasNotes = typeof input === "object" && input !== null && "notes" in input;
    await tx
      .update(listings)
      .set(hasNotes ? { notes: data.notes ?? null, updatedAt: new Date() } : { updatedAt: new Date() })
      .where(eq(listings.id, listingId));
    if (data.product) {
      if (!(await canMerchantEditCatalog(tx, listing.catalogProductId, user.id, listing.shopId))) {
        throw errors.forbidden(
          "This product is shared with other shops. Use “Report incorrect information” to request a catalogue correction.",
        );
      }
      await updateCatalogProduct(tx, listing.catalogProductId, data.product);
    }
    await audit(tx, ctx, { action: "listing.update", targetType: "listing", targetId: listingId });
  });
}

// ---------------------------------------------------------------------------
// Merchant queries
// ---------------------------------------------------------------------------

const listQuerySchema = pageSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "published", "unpublished", "archived", "discontinued", "restricted", "active"]).optional(),
  stock: z.enum(["in_stock", "low_stock", "out_of_stock", "unknown", "stale"]).optional(),
  sort: z.enum(["updated", "name", "price"]).default("updated"),
});

export async function listMerchantListings(ctx: Ctx, shopId: string, query: unknown) {
  await requireShopPermission(ctx, shopId, "shop.view");
  const q = parseInput(listQuerySchema, query ?? {});
  const db = getDb();
  const conds: SQL[] = [eq(listings.shopId, shopId)];
  if (q.status === "active") conds.push(inArray(listings.status, ["draft", "published", "unpublished"]));
  else if (q.status) conds.push(eq(listings.status, q.status));
  else conds.push(inArray(listings.status, ["draft", "published", "unpublished", "discontinued", "restricted"]));
  if (q.q) {
    const t = `%${q.q.replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(catalogProducts.name, t), ilike(catalogProducts.model, t), ilike(brands.name, t))!);
  }
  if (q.stock === "stale") {
    conds.push(sql`exists (select 1 from inventory i where i.listing_id = ${listings.id} and i.stock_updated_at < now() - make_interval(days => ${STALE_AFTER_DAYS}))`);
  } else if (q.stock) {
    conds.push(sql`exists (select 1 from inventory i where i.listing_id = ${listings.id} and i.stock_status = ${q.stock})`);
  }
  const where = and(...conds);
  const minPrice = sql<number>`(select min(i.price_minor) from inventory i where i.listing_id = ${listings.id})`;
  const order =
    q.sort === "name" ? asc(catalogProducts.name) : q.sort === "price" ? asc(minPrice) : desc(listings.updatedAt);

  const [items, total] = await Promise.all([
    db
      .select({
        id: listings.id,
        status: listings.status,
        updatedAt: listings.updatedAt,
        productId: catalogProducts.id,
        productSlug: catalogProducts.slug,
        name: catalogProducts.name,
        model: catalogProducts.model,
        variant: catalogProducts.variant,
        brand: brands.name,
        minPrice,
        stockStatuses: sql<string[]>`(select coalesce(array_agg(distinct i.stock_status), '{}') from inventory i where i.listing_id = ${listings.id})`,
        totalQuantity: sql<number | null>`(select sum(i.quantity)::int from inventory i where i.listing_id = ${listings.id})`,
        oldestStockUpdate: sql<Date | null>`(select min(i.stock_updated_at) from inventory i where i.listing_id = ${listings.id})`,
        imageUrl: sql<string | null>`(select pi.url from product_images pi where pi.listing_id = ${listings.id} or pi.catalog_product_id = ${catalogProducts.id} order by (pi.listing_id is null), pi.sort_order limit 1)`,
      })
      .from(listings)
      .innerJoin(catalogProducts, eq(catalogProducts.id, listings.catalogProductId))
      .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
      .where(where)
      .orderBy(order)
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .innerJoin(catalogProducts, eq(catalogProducts.id, listings.catalogProductId))
      .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
      .where(where),
  ]);
  return {
    items: items.map((i) => ({ ...i, oldestStockUpdate: i.oldestStockUpdate ? new Date(i.oldestStockUpdate) : null })),
    page: q.page,
    pageSize: q.pageSize,
    total: total[0]?.n ?? 0,
  };
}

export async function getMerchantListing(ctx: Ctx, listingId: string) {
  const { listing, role, user } = await loadListing(ctx, listingId, "shop.view");
  const db = getDb();
  const [product] = await db
    .select({ p: catalogProducts, brand: brands.name, category: categories.name })
    .from(catalogProducts)
    .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
    .leftJoin(categories, eq(categories.id, catalogProducts.categoryId))
    .where(eq(catalogProducts.id, listing.catalogProductId));
  const [stock, images, history, branchRows, editableCatalog] = await Promise.all([
    db
      .select({
        id: inventory.id,
        branchId: inventory.branchId,
        branchName: branches.name,
        priceMinor: inventory.priceMinor,
        mrpMinor: inventory.mrpMinor,
        currency: inventory.currency,
        quantity: inventory.quantity,
        stockStatus: inventory.stockStatus,
        lowStockThreshold: inventory.lowStockThreshold,
        stockUpdatedAt: inventory.stockUpdatedAt,
        priceUpdatedAt: inventory.priceUpdatedAt,
        version: inventory.version,
      })
      .from(inventory)
      .innerJoin(branches, eq(branches.id, inventory.branchId))
      .where(eq(inventory.listingId, listingId))
      .orderBy(desc(branches.isPrimary)),
    db
      .select({ id: productImages.id, url: productImages.url, alt: productImages.alt, listingId: productImages.listingId })
      .from(productImages)
      .where(or(eq(productImages.listingId, listingId), eq(productImages.catalogProductId, listing.catalogProductId)))
      .orderBy(asc(productImages.sortOrder)),
    db
      .select({
        id: inventoryHistory.id,
        createdAt: inventoryHistory.createdAt,
        oldPriceMinor: inventoryHistory.oldPriceMinor,
        newPriceMinor: inventoryHistory.newPriceMinor,
        oldQuantity: inventoryHistory.oldQuantity,
        newQuantity: inventoryHistory.newQuantity,
        oldStockStatus: inventoryHistory.oldStockStatus,
        newStockStatus: inventoryHistory.newStockStatus,
        branchName: branches.name,
      })
      .from(inventoryHistory)
      .innerJoin(inventory, eq(inventory.id, inventoryHistory.inventoryId))
      .innerJoin(branches, eq(branches.id, inventory.branchId))
      .where(eq(inventory.listingId, listingId))
      .orderBy(desc(inventoryHistory.createdAt))
      .limit(25),
    db
      .select({ id: branches.id, name: branches.name, hasLocation: sql<boolean>`${branches.location} is not null` })
      .from(branches)
      .where(and(eq(branches.shopId, listing.shopId), eq(branches.isActive, true))),
    canMerchantEditCatalog(db, listing.catalogProductId, user.id, listing.shopId),
  ]);
  return { listing, role, product: product!, stock, images, history, branches: branchRows, editableCatalog };
}

/** Counts that drive dashboard warnings. */
export async function listingHealth(shopId: string) {
  const db = getDb();
  const rows = await db.execute<{
    published: number;
    drafts: number;
    low_stock: number;
    out_of_stock: number;
    stale: number;
  }>(sql`
    select
      count(*) filter (where l.status = 'published')::int as published,
      count(*) filter (where l.status = 'draft')::int as drafts,
      count(*) filter (where l.status = 'published' and exists (select 1 from inventory i where i.listing_id = l.id and i.stock_status = 'low_stock'))::int as low_stock,
      count(*) filter (where l.status = 'published' and not exists (select 1 from inventory i where i.listing_id = l.id and i.stock_status <> 'out_of_stock'))::int as out_of_stock,
      count(*) filter (where l.status = 'published' and exists (select 1 from inventory i where i.listing_id = l.id and i.stock_updated_at < now() - make_interval(days => ${STALE_AFTER_DAYS})))::int as stale
    from listings l where l.shop_id = ${shopId}
  `);
  return rows[0]!;
}

export async function attachListingImage(tx: Tx, listingId: string, image: { url: string; mediaAssetId: string; alt?: string }) {
  const count = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(productImages)
    .where(eq(productImages.listingId, listingId));
  if ((count[0]?.n ?? 0) >= 8) throw errors.limit("A listing can have at most 8 photos.");
  await tx.insert(productImages).values({
    listingId,
    url: image.url,
    mediaAssetId: image.mediaAssetId,
    alt: image.alt ?? null,
    sortOrder: count[0]?.n ?? 0,
  });
}

export async function removeListingImage(ctx: Ctx, listingId: string, imageId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await loadListing(ctx, listingId, "listing.manage", tx);
    const [removed] = await tx
      .delete(productImages)
      .where(and(eq(productImages.id, imageId), eq(productImages.listingId, listingId)))
      .returning({ mediaAssetId: productImages.mediaAssetId });
    if (!removed) throw errors.notFound("Image");
  });
}

