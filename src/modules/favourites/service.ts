import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { brands, catalogProducts, favouriteProducts, favouriteShops, shops } from "@/db/schema";
import { errors } from "@/lib/errors";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requireUser } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";

const toggleSchema = z.object({ kind: z.enum(["product", "shop"]), id: uuidSchema, saved: z.boolean() });

/** Idempotent save/unsave. Returns the resulting state. */
export async function setFavourite(ctx: Ctx, input: unknown): Promise<{ saved: boolean }> {
  const user = requireUser(ctx);
  const data = parseInput(toggleSchema, input);
  const db = getDb();
  if (data.kind === "product") {
    const exists = await db.select({ id: catalogProducts.id }).from(catalogProducts).where(eq(catalogProducts.id, data.id));
    if (!exists[0]) throw errors.notFound("Product");
    if (data.saved) {
      await db.insert(favouriteProducts).values({ userId: user.id, catalogProductId: data.id }).onConflictDoNothing();
    } else {
      await db
        .delete(favouriteProducts)
        .where(and(eq(favouriteProducts.userId, user.id), eq(favouriteProducts.catalogProductId, data.id)));
    }
  } else {
    const exists = await db.select({ id: shops.id }).from(shops).where(eq(shops.id, data.id));
    if (!exists[0]) throw errors.notFound("Shop");
    if (data.saved) {
      await db.insert(favouriteShops).values({ userId: user.id, shopId: data.id }).onConflictDoNothing();
    } else {
      await db.delete(favouriteShops).where(and(eq(favouriteShops.userId, user.id), eq(favouriteShops.shopId, data.id)));
    }
  }
  return { saved: data.saved };
}

export async function isSaved(ctx: Ctx, kind: "product" | "shop", id: string): Promise<boolean> {
  if (!ctx.actor) return false;
  const db = getDb();
  const rows =
    kind === "product"
      ? await db
          .select({ x: favouriteProducts.userId })
          .from(favouriteProducts)
          .where(and(eq(favouriteProducts.userId, ctx.actor.id), eq(favouriteProducts.catalogProductId, id)))
      : await db
          .select({ x: favouriteShops.userId })
          .from(favouriteShops)
          .where(and(eq(favouriteShops.userId, ctx.actor.id), eq(favouriteShops.shopId, id)));
  return rows.length > 0;
}

export async function listFavourites(ctx: Ctx) {
  const user = requireUser(ctx);
  const db = getDb();
  const [products, shopRows] = await Promise.all([
    db
      .select({
        id: catalogProducts.id,
        slug: catalogProducts.slug,
        name: catalogProducts.name,
        variant: catalogProducts.variant,
        brand: brands.name,
        savedAt: favouriteProducts.createdAt,
        imageUrl: sql<string | null>`(select pi.url from product_images pi where pi.catalog_product_id = ${catalogProducts.id} order by pi.sort_order limit 1)`,
        sellerCount: sql<number>`(select count(*)::int from listings l join shops s on s.id = l.shop_id where l.catalog_product_id = ${catalogProducts.id} and l.status = 'published' and s.status = 'active')`,
        minPrice: sql<number | null>`(select min(i.price_minor) from inventory i join listings l on l.id = i.listing_id join shops s on s.id = l.shop_id where l.catalog_product_id = ${catalogProducts.id} and l.status = 'published' and s.status = 'active')`,
      })
      .from(favouriteProducts)
      .innerJoin(catalogProducts, eq(catalogProducts.id, favouriteProducts.catalogProductId))
      .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
      .where(eq(favouriteProducts.userId, user.id))
      .orderBy(desc(favouriteProducts.createdAt)),
    db
      .select({
        id: shops.id,
        slug: shops.slug,
        name: shops.name,
        logoUrl: shops.logoUrl,
        status: shops.status,
        isVerified: shops.isVerified,
        savedAt: favouriteShops.createdAt,
      })
      .from(favouriteShops)
      .innerJoin(shops, eq(shops.id, favouriteShops.shopId))
      .where(eq(favouriteShops.userId, user.id))
      .orderBy(desc(favouriteShops.createdAt)),
  ]);
  // Hide shops that are no longer public, but keep the count honest.
  return { products, shops: shopRows.filter((s) => s.status === "active"), hiddenShops: shopRows.filter((s) => s.status !== "active").length };
}
