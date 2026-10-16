import { and, asc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/db/client";
import { brands, catalogProducts, categories, listings, productImages } from "@/db/schema";
import { errors, isUniqueViolation } from "@/lib/errors";
import { slugify, uniqueSlug } from "@/lib/text";
import { parseInput, uuidSchema } from "@/lib/validation";
import type { Ctx } from "@/modules/auth/context";
import { buildSearchText, productIdentityKey } from "./identity";

export const specsSchema = z
  .record(z.string().trim().min(1).max(40), z.string().trim().min(1).max(200))
  .refine((r) => Object.keys(r).length <= 30, "Add at most 30 specifications.");

export const catalogInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the product name.").max(140),
  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(80).optional(),
  variant: z.string().trim().max(80).optional(),
  categoryId: uuidSchema,
  description: z.string().trim().max(4000).optional(),
  specs: specsSchema.default({}),
  aliases: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
  gtin: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, "Barcode (GTIN) must be 8–14 digits.")
    .optional(),
});
export type CatalogInput = z.infer<typeof catalogInputSchema>;

// ---------------------------------------------------------------------------
// Taxonomy queries
// ---------------------------------------------------------------------------

export async function listCategories(opts: { scope?: "product" | "shop"; includeInactive?: boolean } = {}) {
  const db = getDb();
  const conds = [];
  if (!opts.includeInactive) conds.push(eq(categories.isActive, true));
  if (opts.scope) conds.push(inArray(categories.scope, [opts.scope, "both"]));
  return db
    .select()
    .from(categories)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryBySlug(slug: string) {
  return getDb().query.categories.findFirst({ where: and(eq(categories.slug, slug), eq(categories.isActive, true)) });
}

export async function findOrCreateBrand(tx: Tx, name: string | undefined | null) {
  if (!name) return null;
  const slug = slugify(name);
  if (!slug) return null;
  const existing = await tx.select().from(brands).where(or(eq(brands.slug, slug), sql`${slug} = any(${brands.aliases})`)).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await tx.insert(brands).values({ slug, name }).onConflictDoNothing().returning();
  return created ?? (await tx.select().from(brands).where(eq(brands.slug, slug)).limit(1))[0]!;
}

/** Recompute the denormalised search text for a catalogue product. */
export async function refreshSearchText(tx: Tx, productId: string) {
  const rows = await tx
    .select({
      p: catalogProducts,
      brandName: brands.name,
      brandAliases: brands.aliases,
      categoryName: categories.name,
      parentCategoryName: sql<string | null>`(select pc.name from categories pc where pc.id = ${categories.parentId})`,
    })
    .from(catalogProducts)
    .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
    .leftJoin(categories, eq(categories.id, catalogProducts.categoryId))
    .where(eq(catalogProducts.id, productId))
    .limit(1);
  const r = rows[0];
  if (!r) return;
  const text = buildSearchText({
    name: r.p.name,
    brand: r.brandName,
    brandAliases: r.brandAliases ?? [],
    model: r.p.model,
    variant: r.p.variant,
    aliases: r.p.aliases,
    category: [r.categoryName, r.parentCategoryName].filter(Boolean).join(" "),
    specs: r.p.specs,
  });
  await tx.update(catalogProducts).set({ searchText: text }).where(eq(catalogProducts.id, productId));
}

// ---------------------------------------------------------------------------
// Catalogue matching & creation
// ---------------------------------------------------------------------------

/** Suggest existing catalogue entries while a merchant types a product name. */
export async function suggestCatalogProducts(q: string, limit = 8) {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  return getDb()
    .select({
      id: catalogProducts.id,
      name: catalogProducts.name,
      model: catalogProducts.model,
      variant: catalogProducts.variant,
      brand: brands.name,
      categoryId: catalogProducts.categoryId,
    })
    .from(catalogProducts)
    .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
    .where(
      and(
        eq(catalogProducts.status, "active"),
        or(
          sql`${catalogProducts.searchVector} @@ websearch_to_tsquery('english', ${term})`,
          sql`${catalogProducts.searchText} % ${term}`,
          ilike(catalogProducts.name, `%${term.replace(/[%_]/g, "")}%`),
        ),
      ),
    )
    .orderBy(sql`similarity(${catalogProducts.searchText}, ${term}) desc`)
    .limit(limit);
}

/**
 * Resolve merchant input to a catalogue product: reuse an existing entry with
 * the same identity key, otherwise create a new one. Never mutates an
 * existing shared entry (other shops may list it).
 */
export async function resolveCatalogProduct(tx: Tx, actorId: string, input: CatalogInput) {
  const identityKey = productIdentityKey(input);
  const found = await tx
    .select()
    .from(catalogProducts)
    .where(and(eq(catalogProducts.identityKey, identityKey), ne(catalogProducts.status, "merged")))
    .limit(1);
  if (found[0]) {
    if (found[0].status === "restricted") {
      throw errors.forbidden("This product is restricted on Locafy and cannot be listed.");
    }
    return { product: found[0], created: false };
  }
  await assertCategoryExists(tx, input.categoryId);
  const brand = await findOrCreateBrand(tx, input.brand);
  try {
    const [product] = await tx
      .insert(catalogProducts)
      .values({
        slug: uniqueSlug([input.brand, input.name, input.variant].filter(Boolean).join(" ")),
        name: input.name,
        brandId: brand?.id ?? null,
        model: input.model ?? null,
        variant: input.variant ?? null,
        identityKey,
        categoryId: input.categoryId,
        description: input.description ?? null,
        specs: input.specs,
        aliases: input.aliases,
        gtin: input.gtin ?? null,
        createdBy: actorId,
      })
      .returning();
    await refreshSearchText(tx, product!.id);
    return { product: product!, created: true };
  } catch (e) {
    if (isUniqueViolation(e, "catalog_products_identity_key")) {
      const again = await tx.select().from(catalogProducts).where(eq(catalogProducts.identityKey, identityKey)).limit(1);
      if (again[0]) return { product: again[0], created: false };
    }
    throw e;
  }
}

async function assertCategoryExists(tx: Tx, id: string) {
  const c = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).limit(1);
  if (!c[0]) throw errors.validation("Choose a valid category.", { categoryId: ["Choose a valid category."] });
}

/**
 * A merchant may edit a catalogue entry only if they created it and no other
 * shop lists it. Otherwise corrections go through admins (reports).
 */
export async function canMerchantEditCatalog(tx: Tx, productId: string, actorId: string, shopId: string) {
  const p = await tx.query.catalogProducts.findFirst({ where: eq(catalogProducts.id, productId) });
  if (!p || p.createdBy !== actorId || p.status !== "active") return false;
  const others = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(and(eq(listings.catalogProductId, productId), ne(listings.shopId, shopId)));
  return (others[0]?.n ?? 0) === 0;
}

export async function updateCatalogProduct(tx: Tx, productId: string, input: unknown) {
  const data = parseInput(catalogInputSchema, input);
  const brand = await findOrCreateBrand(tx, data.brand);
  try {
    await tx
      .update(catalogProducts)
      .set({
        name: data.name,
        brandId: brand?.id ?? null,
        model: data.model ?? null,
        variant: data.variant ?? null,
        identityKey: productIdentityKey(data),
        categoryId: data.categoryId,
        description: data.description ?? null,
        specs: data.specs,
        aliases: data.aliases,
        gtin: data.gtin ?? null,
        updatedAt: new Date(),
      })
      .where(eq(catalogProducts.id, productId));
  } catch (e) {
    if (isUniqueViolation(e, "catalog_products_identity_key")) {
      throw errors.conflict("Another catalogue product already has this brand, model and variant.");
    }
    throw e;
  }
  await refreshSearchText(tx, productId);
}

export async function getCatalogImages(productId: string) {
  return getDb()
    .select({ id: productImages.id, url: productImages.url, alt: productImages.alt })
    .from(productImages)
    .where(eq(productImages.catalogProductId, productId))
    .orderBy(asc(productImages.sortOrder));
}

export function ctxUserId(ctx: Ctx) {
  if (!ctx.actor) throw errors.unauthenticated();
  return ctx.actor.id;
}
