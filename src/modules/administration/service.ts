import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/db/client";
import {
  auditLogs,
  brands,
  catalogProducts,
  categories,
  enquiries,
  errorLogs,
  favouriteProducts,
  listings,
  moderationActions,
  offers,
  plans,
  productImages,
  reports,
  reviews,
  searchSynonyms,
  shopMembers,
  shops,
  sponsoredPlacements,
  subscriptions,
  users,
  type Entitlements,
} from "@/db/schema";
import { errors, isUniqueViolation } from "@/lib/errors";
import { slugify } from "@/lib/text";
import { checkbox, moneySchema, pageSchema, parseInput, uuidSchema } from "@/lib/validation";
import { requireAdmin, requireSuperAdmin } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { revokeAllSessions } from "@/modules/auth/sessions";
import { catalogInputSchema, refreshSearchText, updateCatalogProduct } from "@/modules/catalog/service";
import { notify } from "@/modules/notifications/service";
import { audit } from "@/modules/platform/audit";
import { clearSynonymCache } from "@/modules/search/service";
import { assertFeature, getShopPlan } from "@/modules/subscriptions/entitlements";

const reasonSchema = z.object({ reason: z.string({ message: "Give a short reason." }).trim().min(3, "Give a short reason.").max(500) });

async function recordModeration(
  tx: Tx,
  ctx: Ctx,
  m: { targetType: string; targetId: string; action: string; reason?: string | null; reportId?: string | null },
) {
  await tx.insert(moderationActions).values({
    moderatorId: ctx.actor?.id ?? null,
    targetType: m.targetType,
    targetId: m.targetId,
    action: m.action,
    reason: m.reason ?? null,
    reportId: m.reportId ?? null,
  });
  await audit(tx, ctx, { action: `admin.${m.targetType}.${m.action}`, targetType: m.targetType, targetId: m.targetId, metadata: { reason: m.reason } });
}

async function notifyShopOwners(tx: Tx, shopId: string, n: { type: string; title: string; body?: string; link?: string }) {
  const owners = await tx
    .select({ userId: shopMembers.userId })
    .from(shopMembers)
    .where(and(eq(shopMembers.shopId, shopId), eq(shopMembers.role, "owner")));
  for (const o of owners) await notify(tx, { ...n, userId: o.userId, emailPref: "emailShopStatus" });
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function overview(ctx: Ctx) {
  requireAdmin(ctx);
  const rows = (await getDb().execute(sql`
    select
      (select count(*)::int from users where status <> 'deleted') as users,
      (select count(*)::int from users where deletion_requested_at is not null and status <> 'deleted') as deletion_requests,
      (select count(*)::int from shops) as shops,
      (select count(*)::int from shops where status = 'active') as active_shops,
      (select count(*)::int from shops where status = 'pending') as pending_shops,
      (select count(*)::int from listings where status = 'published') as published_listings,
      (select count(*)::int from catalog_products where status = 'active') as catalog_products,
      (select count(*)::int from offers where status = 'published' and starts_at <= now() and ends_at > now()) as active_offers,
      (select count(*)::int from reports where status = 'open') as open_reports,
      (select count(*)::int from search_logs where created_at > now() - interval '7 days') as searches_7d,
      (select count(*)::int from search_logs where created_at > now() - interval '7 days' and result_count = 0) as zero_result_7d,
      (select percentile_cont(0.95) within group (order by duration_ms) from search_logs where created_at > now() - interval '7 days') as search_p95_ms,
      (select count(*)::int from subscriptions s join plans p on p.id = s.plan_id where s.status in ('active','trialing','past_due') and p.price_minor > 0) as paid_subscriptions,
      (select count(*)::int from error_logs where created_at > now() - interval '24 hours') as errors_24h
  `)) as unknown as Record<string, number | null>[];
  return rows[0]!;
}

export async function searchQuality(ctx: Ctx) {
  requireAdmin(ctx);
  const db = getDb();
  const [top, zero] = await Promise.all([
    db.execute(sql`select query, count(*)::int as n, round(avg(result_count))::int as avg_results
      from search_logs where created_at > now() - interval '30 days' group by query order by n desc limit 15`),
    db.execute(sql`select query, count(*)::int as n from search_logs
      where created_at > now() - interval '30 days' and result_count = 0 group by query order by n desc limit 15`),
  ]);
  return { top: [...top] as { query: string; n: number; avg_results: number }[], zero: [...zero] as { query: string; n: number }[] };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const userListSchema = pageSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["active", "suspended", "deleted", "deletion_requested"]).optional(),
});

export async function listUsers(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const q = parseInput(userListSchema, input ?? {});
  const conds: SQL[] = [];
  if (q.q) conds.push(or(ilike(users.email, `%${q.q}%`), ilike(users.name, `%${q.q}%`))!);
  if (q.status === "deletion_requested") conds.push(sql`${users.deletionRequestedAt} is not null and ${users.status} <> 'deleted'`);
  else if (q.status) conds.push(eq(users.status, q.status));
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const [items, total] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        platformRole: users.platformRole,
        createdAt: users.createdAt,
        deletionRequestedAt: users.deletionRequestedAt,
        shopCount: sql<number>`(select count(*)::int from shop_members m where m.user_id = ${users.id})`,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  return { items, total: total[0]?.n ?? 0, page: q.page, pageSize: q.pageSize };
}

export async function getUser(ctx: Ctx, userId: string) {
  requireAdmin(ctx);
  parseInput(uuidSchema, userId);
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { passwordHash: false } });
  if (!user) throw errors.notFound("User");
  const [memberships, history] = await Promise.all([
    db
      .select({ shopId: shops.id, name: shops.name, status: shops.status, role: shopMembers.role })
      .from(shopMembers)
      .innerJoin(shops, eq(shops.id, shopMembers.shopId))
      .where(eq(shopMembers.userId, userId)),
    db
      .select()
      .from(auditLogs)
      .where(or(and(eq(auditLogs.targetType, "user"), eq(auditLogs.targetId, userId)), eq(auditLogs.actorId, userId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30),
  ]);
  return { user, memberships, history };
}

async function guardTargetUser(ctx: Ctx, userId: string) {
  const admin = requireAdmin(ctx);
  parseInput(uuidSchema, userId);
  if (admin.id === userId) throw errors.invalidState("You cannot change your own account status.");
  const target = await getDb().query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) throw errors.notFound("User");
  // Only super admins can act on other administrators.
  if (target.platformRole !== "user" && admin.platformRole !== "super_admin") {
    throw errors.forbidden("Only a super administrator can change another administrator.");
  }
  return target;
}

export async function suspendUser(ctx: Ctx, userId: string, input: unknown) {
  const { reason } = parseInput(reasonSchema, input);
  await guardTargetUser(ctx, userId);
  await getDb().transaction(async (tx) => {
    await tx.update(users).set({ status: "suspended", suspendedReason: reason, updatedAt: new Date() }).where(eq(users.id, userId));
    await revokeAllSessions(tx, userId);
    await recordModeration(tx, ctx, { targetType: "user", targetId: userId, action: "suspend", reason });
  });
}

export async function reactivateUser(ctx: Ctx, userId: string) {
  const target = await guardTargetUser(ctx, userId);
  if (target.status !== "suspended") throw errors.invalidState("Only suspended accounts can be reactivated.");
  await getDb().transaction(async (tx) => {
    await tx.update(users).set({ status: "active", suspendedReason: null, updatedAt: new Date() }).where(eq(users.id, userId));
    await recordModeration(tx, ctx, { targetType: "user", targetId: userId, action: "reactivate" });
  });
}

export async function setPlatformRole(ctx: Ctx, userId: string, input: unknown) {
  requireSuperAdmin(ctx);
  const { role } = parseInput(z.object({ role: z.enum(["user", "admin", "super_admin"]) }), input);
  await guardTargetUser(ctx, userId);
  await getDb().transaction(async (tx) => {
    await tx.update(users).set({ platformRole: role, updatedAt: new Date() }).where(eq(users.id, userId));
    await revokeAllSessions(tx, userId);
    await audit(tx, ctx, { action: "admin.user.set_role", targetType: "user", targetId: userId, metadata: { role } });
  });
}

/**
 * Complete an account deletion: personal data is anonymised, sessions are
 * revoked, enquiry messages remain for the shop's records but are detached
 * from identity. Shops solely owned by the user are suspended.
 */
export async function processAccountDeletion(ctx: Ctx, userId: string) {
  const target = await guardTargetUser(ctx, userId);
  if (target.status === "deleted") throw errors.invalidState("This account is already deleted.");
  await getDb().transaction(async (tx) => {
    const owned = await tx
      .select({ shopId: shopMembers.shopId })
      .from(shopMembers)
      .where(and(eq(shopMembers.userId, userId), eq(shopMembers.role, "owner")));
    for (const o of owned) {
      const otherOwners = await tx
        .select({ u: shopMembers.userId })
        .from(shopMembers)
        .where(and(eq(shopMembers.shopId, o.shopId), eq(shopMembers.role, "owner"), ne(shopMembers.userId, userId)));
      if (!otherOwners.length) {
        await tx.update(shops).set({ status: "suspended", statusReason: "Owner account deleted" }).where(eq(shops.id, o.shopId));
      }
    }
    await tx.delete(shopMembers).where(eq(shopMembers.userId, userId));
    await tx.delete(favouriteProducts).where(eq(favouriteProducts.userId, userId));
    await tx
      .update(users)
      .set({
        status: "deleted",
        email: `deleted+${userId}@deleted.invalid`,
        name: "Deleted user",
        phone: null,
        passwordHash: null,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    await revokeAllSessions(tx, userId);
    await audit(tx, ctx, { action: "admin.user.delete", targetType: "user", targetId: userId });
  });
}

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

const shopListSchema = pageSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "pending", "active", "rejected", "suspended"]).optional(),
});

export async function listShops(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const q = parseInput(shopListSchema, input ?? {});
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(shops.status, q.status));
  if (q.q) conds.push(ilike(shops.name, `%${q.q}%`));
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const [items, total] = await Promise.all([
    db
      .select({
        id: shops.id,
        name: shops.name,
        slug: shops.slug,
        status: shops.status,
        isVerified: shops.isVerified,
        submittedAt: shops.submittedAt,
        createdAt: shops.createdAt,
        city: sql<string | null>`(select b.city from branches b where b.shop_id = shops.id and b.is_primary limit 1)`,
        listingCount: sql<number>`(select count(*)::int from listings l where l.shop_id = shops.id and l.status = 'published')`,
        possibleDuplicates: sql<number>`(select count(*)::int from shops s2 where s2.id <> shops.id and similarity(lower(s2.name), lower(shops.name)) > 0.6
            and exists (select 1 from branches b1 join branches b2 on ST_DWithin(b1.location, b2.location, 300) where b1.shop_id = shops.id and b2.shop_id = s2.id))`,
      })
      .from(shops)
      .where(where)
      .orderBy(q.status === "pending" ? asc(shops.submittedAt) : desc(shops.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(shops).where(where),
  ]);
  return { items, total: total[0]?.n ?? 0, page: q.page, pageSize: q.pageSize };
}

export async function getShopForAdmin(ctx: Ctx, shopId: string) {
  requireAdmin(ctx);
  parseInput(uuidSchema, shopId);
  const db = getDb();
  const shop = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
  if (!shop) throw errors.notFound("Shop");
  const [members, branchRows, category, plan, history, duplicates] = await Promise.all([
    db
      .select({ userId: users.id, name: users.name, email: users.email, role: shopMembers.role })
      .from(shopMembers)
      .innerJoin(users, eq(users.id, shopMembers.userId))
      .where(eq(shopMembers.shopId, shopId)),
    db.execute(sql`select id, name, address_line, locality, city, postal_code, is_primary,
      ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng from branches where shop_id = ${shopId}`),
    shop.categoryId ? db.query.categories.findFirst({ where: eq(categories.id, shop.categoryId) }) : null,
    getShopPlan(db, shopId),
    db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.targetType, "shop"), eq(auditLogs.targetId, shopId)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20),
    db.execute(sql`select s2.id, s2.name, s2.status from shops s2 where s2.id <> ${shopId}
      and similarity(lower(s2.name), lower(${shop.name})) > 0.5 limit 5`),
  ]);
  return {
    shop,
    members,
    branches: [...branchRows] as Record<string, unknown>[],
    category: category ?? null,
    plan,
    history,
    duplicates: [...duplicates] as { id: string; name: string; status: string }[],
  };
}

type ShopDecision = "approve" | "reject" | "suspend" | "reactivate";

const SHOP_DECISIONS: Record<ShopDecision, { from: string[]; to: "active" | "rejected" | "suspended"; needsReason: boolean }> = {
  approve: { from: ["pending"], to: "active", needsReason: false },
  reject: { from: ["pending"], to: "rejected", needsReason: true },
  suspend: { from: ["active", "pending"], to: "suspended", needsReason: true },
  reactivate: { from: ["suspended"], to: "active", needsReason: false },
};

export async function decideShop(ctx: Ctx, shopId: string, decision: ShopDecision, input: unknown = {}) {
  requireAdmin(ctx);
  parseInput(uuidSchema, shopId);
  const rule = SHOP_DECISIONS[decision];
  const reason = rule.needsReason ? parseInput(reasonSchema, input).reason : ((input as { reason?: string })?.reason ?? null);
  const db = getDb();
  await db.transaction(async (tx) => {
    const [shop] = await tx.select().from(shops).where(eq(shops.id, shopId)).for("update");
    if (!shop) throw errors.notFound("Shop");
    if (!rule.from.includes(shop.status)) throw errors.invalidState(`Cannot ${decision} a shop that is ${shop.status}.`);
    await tx
      .update(shops)
      .set({
        status: rule.to,
        statusReason: reason,
        approvedAt: decision === "approve" ? new Date() : shop.approvedAt,
        updatedAt: new Date(),
      })
      .where(eq(shops.id, shopId));
    await recordModeration(tx, ctx, { targetType: "shop", targetId: shopId, action: decision, reason });
    const messages: Record<ShopDecision, string> = {
      approve: `${shop.name} is approved and visible on Locafy`,
      reject: `${shop.name} needs changes before approval`,
      suspend: `${shop.name} has been suspended`,
      reactivate: `${shop.name} has been reactivated`,
    };
    await notifyShopOwners(tx, shopId, { type: `shop.${decision}`, title: messages[decision], body: reason ?? undefined, link: `/merchant/${shopId}` });
  });
}

export async function setShopVerified(ctx: Ctx, shopId: string, verified: boolean) {
  requireAdmin(ctx);
  parseInput(uuidSchema, shopId);
  await getDb().transaction(async (tx) => {
    const [s] = await tx.update(shops).set({ isVerified: verified, updatedAt: new Date() }).where(eq(shops.id, shopId)).returning({ id: shops.id });
    if (!s) throw errors.notFound("Shop");
    await recordModeration(tx, ctx, { targetType: "shop", targetId: shopId, action: verified ? "verify" : "unverify" });
  });
}

const adminShopEditSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional(),
  phone: z.string().trim().max(30).optional(),
});

export async function correctShopInfo(ctx: Ctx, shopId: string, input: unknown) {
  requireAdmin(ctx);
  const data = parseInput(adminShopEditSchema, input);
  await getDb().transaction(async (tx) => {
    const before = await tx.query.shops.findFirst({ where: eq(shops.id, shopId) });
    if (!before) throw errors.notFound("Shop");
    await tx
      .update(shops)
      .set({ name: data.name, description: data.description ?? null, phone: data.phone ?? before.phone, updatedAt: new Date() })
      .where(eq(shops.id, shopId));
    await audit(tx, ctx, {
      action: "admin.shop.correct",
      targetType: "shop",
      targetId: shopId,
      metadata: { before: { name: before.name, phone: before.phone }, after: data },
    });
  });
}

// ---------------------------------------------------------------------------
// Catalogue & taxonomy
// ---------------------------------------------------------------------------

const catalogListSchema = pageSchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["active", "restricted", "merged"]).optional(),
});

export async function listCatalog(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const q = parseInput(catalogListSchema, input ?? {});
  const conds: SQL[] = [];
  if (q.status) conds.push(eq(catalogProducts.status, q.status));
  if (q.q) conds.push(or(ilike(catalogProducts.name, `%${q.q}%`), ilike(catalogProducts.model, `%${q.q}%`), sql`${catalogProducts.searchText} % ${q.q.toLowerCase()}`)!);
  const where = conds.length ? and(...conds) : undefined;
  const db = getDb();
  const [items, total] = await Promise.all([
    db
      .select({
        id: catalogProducts.id,
        slug: catalogProducts.slug,
        name: catalogProducts.name,
        model: catalogProducts.model,
        variant: catalogProducts.variant,
        status: catalogProducts.status,
        brand: brands.name,
        category: categories.name,
        listingCount: sql<number>`(select count(*)::int from listings l where l.catalog_product_id = ${catalogProducts.id})`,
        createdAt: catalogProducts.createdAt,
      })
      .from(catalogProducts)
      .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
      .leftJoin(categories, eq(categories.id, catalogProducts.categoryId))
      .where(where)
      .orderBy(desc(catalogProducts.createdAt))
      .limit(q.pageSize)
      .offset((q.page - 1) * q.pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(catalogProducts).where(where),
  ]);
  return { items, total: total[0]?.n ?? 0, page: q.page, pageSize: q.pageSize };
}

export async function getCatalogProductForAdmin(ctx: Ctx, productId: string) {
  requireAdmin(ctx);
  const db = getDb();
  const rows = await db
    .select({ p: catalogProducts, brand: brands.name })
    .from(catalogProducts)
    .leftJoin(brands, eq(brands.id, catalogProducts.brandId))
    .where(eq(catalogProducts.id, productId));
  if (!rows[0]) throw errors.notFound("Product");
  const shopsListing = await db
    .select({ listingId: listings.id, status: listings.status, shopName: shops.name, shopId: shops.id })
    .from(listings)
    .innerJoin(shops, eq(shops.id, listings.shopId))
    .where(eq(listings.catalogProductId, productId));
  const similar = await db.execute(sql`select id, name, variant, slug from catalog_products
    where id <> ${productId} and status = 'active' and similarity(search_text, ${rows[0].p.searchText}) > 0.5 limit 8`);
  return { product: rows[0].p, brand: rows[0].brand, listings: shopsListing, similar: [...similar] as { id: string; name: string; variant: string | null; slug: string }[] };
}

export async function adminUpdateCatalogProduct(ctx: Ctx, productId: string, input: unknown) {
  requireAdmin(ctx);
  parseInput(catalogInputSchema, input);
  await getDb().transaction(async (tx) => {
    await updateCatalogProduct(tx, productId, input);
    await audit(tx, ctx, { action: "admin.catalog.update", targetType: "product", targetId: productId });
  });
}

export async function setCatalogRestricted(ctx: Ctx, productId: string, restricted: boolean, input: unknown = {}) {
  requireAdmin(ctx);
  const reason = restricted ? parseInput(reasonSchema, input).reason : null;
  await getDb().transaction(async (tx) => {
    const [p] = await tx
      .update(catalogProducts)
      .set({ status: restricted ? "restricted" : "active", updatedAt: new Date() })
      .where(and(eq(catalogProducts.id, productId), ne(catalogProducts.status, "merged")))
      .returning({ id: catalogProducts.id, name: catalogProducts.name });
    if (!p) throw errors.notFound("Product");
    await recordModeration(tx, ctx, { targetType: "product", targetId: productId, action: restricted ? "restrict" : "unrestrict", reason });
  });
}

/**
 * Merge a duplicate catalogue entry into a canonical one. Listings move to the
 * target unless the shop already lists the target (then the duplicate listing
 * is archived — prices are never combined). Favourites, reviews and images
 * follow. The source remains as a "merged" redirect.
 */
export async function mergeCatalogProducts(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const { sourceId, targetId } = parseInput(z.object({ sourceId: uuidSchema, targetId: uuidSchema }), input);
  if (sourceId === targetId) throw errors.validation("Choose two different products.");
  await getDb().transaction(async (tx) => {
    const [src] = await tx.select().from(catalogProducts).where(eq(catalogProducts.id, sourceId)).for("update");
    const [dst] = await tx.select().from(catalogProducts).where(eq(catalogProducts.id, targetId)).for("update");
    if (!src || !dst) throw errors.notFound("Product");
    if (src.status === "merged" || dst.status === "merged") throw errors.invalidState("A merged product cannot be merged again.");

    const srcListings = await tx.select().from(listings).where(eq(listings.catalogProductId, sourceId));
    let moved = 0;
    let archived = 0;
    for (const l of srcListings) {
      const clash = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(and(eq(listings.shopId, l.shopId), eq(listings.catalogProductId, targetId)));
      if (clash[0]) {
        // Keep the duplicate's row (unique key forbids moving it) but take it out of circulation.
        await tx.update(listings).set({ status: "archived", updatedAt: new Date() }).where(eq(listings.id, l.id));
        archived++;
      } else {
        await tx.update(listings).set({ catalogProductId: targetId, updatedAt: new Date() }).where(eq(listings.id, l.id));
        moved++;
      }
    }
    await tx.execute(sql`insert into favourite_products (user_id, catalog_product_id, created_at)
      select user_id, ${targetId}, created_at from favourite_products where catalog_product_id = ${sourceId}
      on conflict do nothing`);
    await tx.delete(favouriteProducts).where(eq(favouriteProducts.catalogProductId, sourceId));
    await tx.execute(sql`update reviews r set catalog_product_id = ${targetId} where r.catalog_product_id = ${sourceId}
      and not exists (select 1 from reviews r2 where r2.author_id = r.author_id and r2.catalog_product_id = ${targetId})`);
    await tx.update(productImages).set({ catalogProductId: targetId }).where(eq(productImages.catalogProductId, sourceId));
    await tx
      .update(catalogProducts)
      .set({ status: "merged", mergedIntoId: targetId, updatedAt: new Date() })
      .where(eq(catalogProducts.id, sourceId));
    await recordModeration(tx, ctx, { targetType: "product", targetId: sourceId, action: "merge", reason: `into ${targetId}; moved ${moved}, archived ${archived}` });
  });
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z.string().trim().max(60).optional(),
  parentId: uuidSchema.optional(),
  icon: z.string().trim().max(40).optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  scope: z.enum(["product", "shop", "both"]).default("both"),
  isActive: checkbox,
});

export async function saveCategory(ctx: Ctx, categoryId: string | null, input: unknown) {
  requireAdmin(ctx);
  const data = parseInput(categorySchema, input);
  const slug = slugify(data.slug || data.name);
  if (data.parentId && data.parentId === categoryId) throw errors.validation("A category cannot be its own parent.");
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const values = { name: data.name, slug, parentId: data.parentId ?? null, icon: data.icon ?? null, sortOrder: data.sortOrder, scope: data.scope, isActive: data.isActive };
      let id = categoryId;
      if (categoryId) await tx.update(categories).set(values).where(eq(categories.id, categoryId));
      else id = (await tx.insert(categories).values(values).returning({ id: categories.id }))[0]!.id;
      // Category names feed product search text.
      const affected = await tx.select({ id: catalogProducts.id }).from(catalogProducts).where(eq(catalogProducts.categoryId, id!));
      for (const p of affected) await refreshSearchText(tx, p.id);
      await audit(tx, ctx, { action: categoryId ? "admin.category.update" : "admin.category.create", targetType: "category", targetId: id! });
    });
  } catch (e) {
    if (isUniqueViolation(e, "categories_slug_key")) throw errors.conflict("A category with this slug already exists.");
    throw e;
  }
}

export async function listBrands(ctx: Ctx) {
  requireAdmin(ctx);
  return getDb()
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      aliases: brands.aliases,
      productCount: sql<number>`(select count(*)::int from catalog_products cp where cp.brand_id = ${brands.id})`,
    })
    .from(brands)
    .orderBy(asc(brands.name));
}

export async function setBrandAliases(ctx: Ctx, brandId: string, input: unknown) {
  requireAdmin(ctx);
  const { aliases } = parseInput(z.object({ aliases: z.string().max(500) }), input);
  const list = [...new Set(aliases.split(",").map((a) => slugify(a)).filter(Boolean))].slice(0, 20);
  await getDb().transaction(async (tx) => {
    await tx.update(brands).set({ aliases: list }).where(eq(brands.id, brandId));
    const affected = await tx.select({ id: catalogProducts.id }).from(catalogProducts).where(eq(catalogProducts.brandId, brandId));
    for (const p of affected) await refreshSearchText(tx, p.id);
    await audit(tx, ctx, { action: "admin.brand.aliases", targetType: "brand", targetId: brandId, metadata: { aliases: list } });
  });
}

export async function listSynonyms(ctx: Ctx) {
  requireAdmin(ctx);
  return getDb().select().from(searchSynonyms).orderBy(asc(searchSynonyms.term));
}

export async function saveSynonym(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const data = parseInput(z.object({ term: z.string().trim().toLowerCase().min(2).max(40), synonyms: z.string().max(400) }), input);
  const list = [...new Set(data.synonyms.split(",").map((s) => s.trim().toLowerCase()).filter((s) => s && s !== data.term))].slice(0, 15);
  if (!list.length) throw errors.validation("Add at least one synonym.", { synonyms: ["Add at least one synonym."] });
  await getDb().transaction(async (tx) => {
    await tx
      .insert(searchSynonyms)
      .values({ term: data.term, synonyms: list })
      .onConflictDoUpdate({ target: searchSynonyms.term, set: { synonyms: list } });
    await audit(tx, ctx, { action: "admin.synonym.save", targetType: "synonym", targetId: data.term });
  });
  clearSynonymCache();
}

export async function deleteSynonym(ctx: Ctx, id: string) {
  requireAdmin(ctx);
  await getDb().delete(searchSynonyms).where(eq(searchSynonyms.id, id));
  clearSynonymCache();
}

// ---------------------------------------------------------------------------
// Moderation: listings, reviews, offers, reports
// ---------------------------------------------------------------------------

export async function setListingRestricted(ctx: Ctx, listingId: string, restricted: boolean, input: unknown = {}) {
  requireAdmin(ctx);
  const reason = restricted ? parseInput(reasonSchema, input).reason : null;
  await getDb().transaction(async (tx) => {
    const l = await tx.query.listings.findFirst({ where: eq(listings.id, listingId) });
    if (!l) throw errors.notFound("Listing");
    if (!restricted && l.status !== "restricted") throw errors.invalidState("This listing is not restricted.");
    await tx
      .update(listings)
      .set({ status: restricted ? "restricted" : "unpublished", restrictedReason: reason, updatedAt: new Date() })
      .where(eq(listings.id, listingId));
    await recordModeration(tx, ctx, { targetType: "listing", targetId: listingId, action: restricted ? "restrict" : "unrestrict", reason });
    await notifyShopOwners(tx, l.shopId, {
      type: restricted ? "listing.restricted" : "listing.unrestricted",
      title: restricted ? "A product listing was restricted by a moderator" : "A listing restriction was lifted",
      body: reason ?? undefined,
      link: `/merchant/${l.shopId}/products/${listingId}`,
    });
  });
}

export async function setReviewStatus(ctx: Ctx, reviewId: string, status: "published" | "hidden" | "removed", input: unknown = {}) {
  requireAdmin(ctx);
  const reason = status === "published" ? null : parseInput(reasonSchema, input).reason;
  await getDb().transaction(async (tx) => {
    const [r] = await tx.update(reviews).set({ status, updatedAt: new Date() }).where(eq(reviews.id, reviewId)).returning();
    if (!r) throw errors.notFound("Review");
    await recordModeration(tx, ctx, { targetType: "review", targetId: reviewId, action: status === "published" ? "restore" : status === "hidden" ? "hide" : "remove", reason });
    if (status !== "published") {
      await notify(tx, { userId: r.authorId, type: "review.moderated", title: "One of your reviews was moderated", body: reason ?? undefined });
    }
  });
}

export async function forceUnpublishOffer(ctx: Ctx, offerId: string, input: unknown) {
  requireAdmin(ctx);
  const { reason } = parseInput(reasonSchema, input);
  await getDb().transaction(async (tx) => {
    const [o] = await tx.update(offers).set({ status: "unpublished", updatedAt: new Date() }).where(eq(offers.id, offerId)).returning();
    if (!o) throw errors.notFound("Offer");
    await recordModeration(tx, ctx, { targetType: "offer", targetId: offerId, action: "unpublish", reason });
    await notifyShopOwners(tx, o.shopId, { type: "offer.unpublished", title: `Offer "${o.title}" was unpublished by a moderator`, body: reason });
  });
}

const reportListSchema = pageSchema.extend({ status: z.enum(["open", "actioned", "dismissed"]).default("open") });

export async function listReports(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const q = parseInput(reportListSchema, input ?? {});
  const rows = (await getDb().execute(sql`
    select r.*, u.name as reporter_name,
      case r.target_type
        when 'shop' then (select s.name from shops s where s.id = r.target_id)
        when 'listing' then (select cp.name || ' @ ' || s.name from listings l join catalog_products cp on cp.id = l.catalog_product_id join shops s on s.id = l.shop_id where l.id = r.target_id)
        when 'product' then (select cp.name from catalog_products cp where cp.id = r.target_id)
        when 'review' then (select left(coalesce(rv.body, rv.rating || '★'), 80) from reviews rv where rv.id = r.target_id)
        when 'offer' then (select o.title from offers o where o.id = r.target_id)
        when 'enquiry' then 'Enquiry ' || left(r.target_id::text, 8)
      end as target_label,
      (select count(*)::int from reports r2 where r2.target_type = r.target_type and r2.target_id = r.target_id and r2.status = 'open') as open_for_target
    from reports r left join users u on u.id = r.reporter_id
    where r.status = ${q.status}
    order by r.created_at ${q.status === "open" ? sql`asc` : sql`desc`}
    limit ${q.pageSize} offset ${(q.page - 1) * q.pageSize}`)) as unknown as Record<string, unknown>[];
  return rows;
}

export async function resolveReport(ctx: Ctx, reportId: string, input: unknown) {
  requireAdmin(ctx);
  const data = parseInput(
    z.object({ outcome: z.enum(["actioned", "dismissed"]), note: z.string().trim().min(3, "Add a short resolution note.").max(1000) }),
    input,
  );
  await getDb().transaction(async (tx) => {
    const [r] = await tx.select().from(reports).where(eq(reports.id, reportId)).for("update");
    if (!r) throw errors.notFound("Report");
    if (r.status !== "open") throw errors.invalidState("This report has already been resolved.");
    // Resolve every open report on the same target together.
    const resolved = await tx
      .update(reports)
      .set({ status: data.outcome, resolutionNote: data.note, resolvedBy: ctx.actor!.id, resolvedAt: new Date() })
      .where(and(eq(reports.targetType, r.targetType), eq(reports.targetId, r.targetId), eq(reports.status, "open")))
      .returning({ reporterId: reports.reporterId });
    await recordModeration(tx, ctx, { targetType: r.targetType, targetId: r.targetId, action: `report_${data.outcome}`, reason: data.note, reportId });
    for (const rep of resolved) {
      if (rep.reporterId) {
        await notify(tx, {
          userId: rep.reporterId,
          type: "report.resolved",
          title: data.outcome === "actioned" ? "Thanks — we acted on your report" : "We reviewed your report",
          body: "Our moderators reviewed the content you reported.",
        });
      }
    }
  });
}

export async function moderationHistory(ctx: Ctx, limit = 50) {
  requireAdmin(ctx);
  return getDb()
    .select({ m: moderationActions, moderator: users.name })
    .from(moderationActions)
    .leftJoin(users, eq(users.id, moderationActions.moderatorId))
    .orderBy(desc(moderationActions.createdAt))
    .limit(limit);
}

export async function listReviewsForModeration(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const { status } = parseInput(z.object({ status: z.enum(["published", "hidden", "removed"]).default("published") }), input ?? {});
  return getDb().execute(sql`
    select r.id, r.rating, r.body, r.status, r.target_type, r.created_at, u.name as author_name,
      coalesce(s.name, cp.name) as target_name,
      (select count(*)::int from reports rp where rp.target_type = 'review' and rp.target_id = r.id and rp.status = 'open') as open_reports
    from reviews r join users u on u.id = r.author_id
    left join shops s on s.id = r.shop_id left join catalog_products cp on cp.id = r.catalog_product_id
    where r.status = ${status}
    order by open_reports desc, r.created_at desc limit 100`);
}

// ---------------------------------------------------------------------------
// Plans, subscriptions, sponsored placements
// ---------------------------------------------------------------------------

const limitField = z.coerce.number().int().min(-1).max(1_000_000);
const planSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{2,30}$/, "Use 2–30 lowercase letters, numbers, - or _."),
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(300).optional(),
  price: moneySchema,
  interval: z.enum(["month", "year"]).default("month"),
  sortOrder: z.coerce.number().int().min(0).max(100).default(0),
  isActive: checkbox,
  maxListings: limitField,
  maxStorageMb: limitField,
  maxBranches: limitField,
  maxStaff: limitField,
  maxActiveOffers: limitField,
  advancedAnalytics: checkbox,
  bulkImport: checkbox,
  promotionScheduling: checkbox,
  sponsoredPlacements: checkbox,
});

export async function listPlans(ctx: Ctx) {
  requireAdmin(ctx);
  return getDb()
    .select({
      plan: plans,
      subscribers: sql<number>`(select count(*)::int from subscriptions s where s.plan_id = ${plans.id} and s.status in ('active','trialing','past_due'))`,
    })
    .from(plans)
    .orderBy(asc(plans.sortOrder));
}

export async function savePlan(ctx: Ctx, planId: string | null, input: unknown) {
  requireSuperAdmin(ctx);
  const d = parseInput(planSchema, input);
  const entitlements: Entitlements = {
    maxListings: d.maxListings,
    maxStorageMb: d.maxStorageMb,
    maxBranches: d.maxBranches,
    maxStaff: d.maxStaff,
    maxActiveOffers: d.maxActiveOffers,
    advancedAnalytics: d.advancedAnalytics,
    bulkImport: d.bulkImport,
    promotionScheduling: d.promotionScheduling,
    sponsoredPlacements: d.sponsoredPlacements,
  };
  const values = {
    code: d.code,
    name: d.name,
    description: d.description ?? null,
    priceMinor: d.price,
    currency: process.env.DEFAULT_CURRENCY ?? "INR",
    interval: d.interval,
    sortOrder: d.sortOrder,
    isActive: d.isActive,
    entitlements,
    updatedAt: new Date(),
  };
  try {
    await getDb().transaction(async (tx) => {
      let id = planId;
      if (planId) {
        const existing = await tx.query.plans.findFirst({ where: eq(plans.id, planId) });
        if (!existing) throw errors.notFound("Plan");
        if (existing.isDefault && !d.isActive) throw errors.invalidState("The default (free) plan cannot be deactivated.");
        await tx.update(plans).set(values).where(eq(plans.id, planId));
      } else {
        id = (await tx.insert(plans).values(values).returning({ id: plans.id }))[0]!.id;
      }
      await audit(tx, ctx, { action: planId ? "admin.plan.update" : "admin.plan.create", targetType: "plan", targetId: id!, metadata: { entitlements } });
    });
  } catch (e) {
    if (isUniqueViolation(e, "plans_code_key")) throw errors.conflict("A plan with this code already exists.");
    throw e;
  }
}

/**
 * Manually assign a plan (no payment provider is configured in the MVP).
 * The previous live subscription is cancelled in the same transaction.
 */
export async function assignPlan(ctx: Ctx, shopId: string, input: unknown) {
  requireAdmin(ctx);
  const data = parseInput(z.object({ planId: uuidSchema, periodDays: z.coerce.number().int().min(1).max(730).optional() }), input);
  await getDb().transaction(async (tx) => {
    const plan = await tx.query.plans.findFirst({ where: and(eq(plans.id, data.planId), eq(plans.isActive, true)) });
    if (!plan) throw errors.notFound("Plan");
    await tx
      .update(subscriptions)
      .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(subscriptions.shopId, shopId), inArray(subscriptions.status, ["active", "trialing", "past_due"])));
    if (!plan.isDefault) {
      await tx.insert(subscriptions).values({
        shopId,
        planId: plan.id,
        status: "active",
        provider: "manual",
        currentPeriodEnd: data.periodDays ? new Date(Date.now() + data.periodDays * 86_400_000) : null,
      });
    }
    await audit(tx, ctx, { action: "admin.subscription.assign", targetType: "shop", targetId: shopId, metadata: { plan: plan.code } });
    await notifyShopOwners(tx, shopId, { type: "subscription.changed", title: `Your shop is now on the ${plan.name} plan`, link: `/merchant/${shopId}/plan` });
  });
}

export async function listSubscriptions(ctx: Ctx) {
  requireAdmin(ctx);
  return getDb()
    .select({ s: subscriptions, planName: plans.name, shopName: shops.name })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(shops, eq(shops.id, subscriptions.shopId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(100);
}

export async function createSponsoredPlacement(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const d = parseInput(
    z.object({ listingId: uuidSchema, startsAt: z.coerce.date(), endsAt: z.coerce.date() }).refine((v) => v.endsAt > v.startsAt, {
      message: "End must be after start.",
      path: ["endsAt"],
    }),
    input,
  );
  await getDb().transaction(async (tx) => {
    const l = await tx.query.listings.findFirst({ where: eq(listings.id, d.listingId) });
    if (!l) throw errors.notFound("Listing");
    if (l.status !== "published") throw errors.invalidState("Only published listings can be sponsored.");
    await assertFeature(tx, l.shopId, "sponsoredPlacements", "Sponsored placement");
    const [sp] = await tx
      .insert(sponsoredPlacements)
      .values({ shopId: l.shopId, listingId: l.id, startsAt: d.startsAt, endsAt: d.endsAt, createdBy: ctx.actor!.id })
      .returning({ id: sponsoredPlacements.id });
    await audit(tx, ctx, { action: "admin.sponsored.create", targetType: "listing", targetId: l.id, metadata: { placementId: sp!.id } });
  });
}

export async function listSponsoredPlacements(ctx: Ctx) {
  requireAdmin(ctx);
  return getDb()
    .select({ sp: sponsoredPlacements, shopName: shops.name, productName: catalogProducts.name })
    .from(sponsoredPlacements)
    .innerJoin(shops, eq(shops.id, sponsoredPlacements.shopId))
    .innerJoin(listings, eq(listings.id, sponsoredPlacements.listingId))
    .innerJoin(catalogProducts, eq(catalogProducts.id, listings.catalogProductId))
    .orderBy(desc(sponsoredPlacements.createdAt))
    .limit(100);
}

export async function deactivateSponsoredPlacement(ctx: Ctx, id: string) {
  requireAdmin(ctx);
  await getDb().transaction(async (tx) => {
    await tx.update(sponsoredPlacements).set({ isActive: false }).where(eq(sponsoredPlacements.id, id));
    await audit(tx, ctx, { action: "admin.sponsored.deactivate", targetType: "sponsored", targetId: id });
  });
}

// ---------------------------------------------------------------------------
// Audit & operations
// ---------------------------------------------------------------------------

export async function listAuditLogs(ctx: Ctx, input: unknown) {
  requireAdmin(ctx);
  const q = parseInput(pageSchema.extend({ action: z.string().max(60).optional() }), input ?? {});
  return getDb()
    .select({ log: auditLogs, actorName: users.name, actorEmail: users.email })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .where(q.action ? ilike(auditLogs.action, `${q.action}%`) : undefined)
    .orderBy(desc(auditLogs.createdAt))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
}

export async function listErrorLogs(ctx: Ctx) {
  requireAdmin(ctx);
  return getDb().select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(100);
}

export async function enquiryVolume(ctx: Ctx) {
  requireAdmin(ctx);
  const rows = await getDb()
    .select({ status: enquiries.status, n: sql<number>`count(*)::int` })
    .from(enquiries)
    .groupBy(enquiries.status);
  return rows;
}

// ---------------------------------------------------------------------------
// Admin UI helpers (additive)
// ---------------------------------------------------------------------------

/** Lightweight counters for the admin navigation badges. */
export async function adminNavCounts(ctx: Ctx) {
  requireAdmin(ctx);
  const rows = (await getDb().execute(sql`
    select
      (select count(*)::int from shops where status = 'pending') as pending_shops,
      (select count(*)::int from reports where status = 'open') as open_reports
  `)) as unknown as { pending_shops: number; open_reports: number }[];
  return { pendingShops: rows[0]?.pending_shops ?? 0, openReports: rows[0]?.open_reports ?? 0 };
}

/** Map listing ids to their catalogue product (for linking reported listings). */
export async function listingProducts(ctx: Ctx, listingIds: string[]) {
  requireAdmin(ctx);
  const ids = listingIds.filter((id) => uuidSchema.safeParse(id).success);
  if (!ids.length) return {} as Record<string, string>;
  const rows = await getDb()
    .select({ id: listings.id, productId: listings.catalogProductId })
    .from(listings)
    .where(inArray(listings.id, ids));
  return Object.fromEntries(rows.map((r) => [r.id, r.productId])) as Record<string, string>;
}
