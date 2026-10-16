import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { branches, categories, shopMembers, shops, users, type OpeningHours } from "@/db/schema";
import { errors } from "@/lib/errors";
import { uniqueSlug } from "@/lib/text";
import { parseInput } from "@/lib/validation";
import { isAdmin, requireShopPermission, requireUser } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { latSql, lngSql } from "@/modules/geo/geo";
import { notify } from "@/modules/notifications/service";
import { audit } from "@/modules/platform/audit";
import { assertWithinLimit } from "@/modules/subscriptions/entitlements";
import {
  branchSchema,
  memberSchema,
  openingHoursSchema,
  shopBasicsSchema,
  shopContactSchema,
  verificationSchema,
} from "./schemas";

export const MAX_SHOPS_PER_OWNER = 3;
const EDITABLE_STATUSES = ["draft", "rejected", "pending", "active"] as const;

// ---------------------------------------------------------------------------
// Onboarding & profile
// ---------------------------------------------------------------------------

export async function createShop(ctx: Ctx, input: unknown) {
  const user = requireUser(ctx);
  const data = parseInput(shopBasicsSchema, input);
  const db = getDb();
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(shopMembers)
      .where(and(eq(shopMembers.userId, user.id), eq(shopMembers.role, "owner")));
    if ((owned[0]?.n ?? 0) >= MAX_SHOPS_PER_OWNER) {
      throw errors.limit(`You can own up to ${MAX_SHOPS_PER_OWNER} shops.`);
    }
    await assertCategory(tx, data.categoryId);
    const [shop] = await tx
      .insert(shops)
      .values({
        slug: uniqueSlug(data.name),
        name: data.name,
        categoryId: data.categoryId,
        description: data.description ?? null,
        status: "draft",
        onboardingStep: 2,
        createdBy: user.id,
      })
      .returning();
    await tx.insert(shopMembers).values({ shopId: shop!.id, userId: user.id, role: "owner" });
    await audit(tx, ctx, { action: "shop.create", targetType: "shop", targetId: shop!.id });
    return shop!;
  });
}

async function assertCategory(tx: Parameters<typeof assertWithinLimit>[0], categoryId: string) {
  const cat = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId), eq(categories.isActive, true))).limit(1);
  if (!cat[0]) throw errors.validation("Choose a valid category.", { categoryId: ["Choose a valid category."] });
}

async function loadEditable(ctx: Ctx, shopId: string, permission: "shop.edit" | "shop.submit" = "shop.edit") {
  const access = await requireShopPermission(ctx, shopId, permission);
  if (!(EDITABLE_STATUSES as readonly string[]).includes(access.shop.status)) {
    throw errors.invalidState("This shop is suspended. Contact support to restore access.");
  }
  return access;
}

export async function updateShopBasics(ctx: Ctx, shopId: string, input: unknown) {
  const { shop } = await loadEditable(ctx, shopId);
  const data = parseInput(shopBasicsSchema, input);
  const db = getDb();
  await assertCategory(db, data.categoryId);
  await db
    .update(shops)
    .set({
      name: data.name,
      categoryId: data.categoryId,
      description: data.description ?? null,
      onboardingStep: Math.max(shop.onboardingStep, 2),
      updatedAt: new Date(),
    })
    .where(eq(shops.id, shopId));
}

export async function updateShopContact(ctx: Ctx, shopId: string, input: unknown) {
  const { shop } = await loadEditable(ctx, shopId);
  const raw = (input ?? {}) as Record<string, unknown>;
  const data = parseInput(shopContactSchema, raw);
  const hours = raw.openingHours === undefined ? undefined : parseInput(openingHoursSchema, raw.openingHours);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(shops)
      .set({
        phone: data.phone,
        whatsapp: data.whatsapp ?? null,
        email: data.email ?? null,
        website: data.website ?? null,
        onboardingStep: Math.max(shop.onboardingStep, 4),
        updatedAt: new Date(),
      })
      .where(eq(shops.id, shopId));
    if (hours !== undefined) {
      await tx
        .update(branches)
        .set({ openingHours: hours as OpeningHours, updatedAt: new Date() })
        .where(and(eq(branches.shopId, shopId), eq(branches.isPrimary, true)));
    }
  });
}

export async function updateShopMedia(ctx: Ctx, shopId: string, input: { logoUrl?: string | null; coverUrl?: string | null }) {
  const { shop } = await loadEditable(ctx, shopId);
  const patch: Partial<typeof shops.$inferInsert> = { updatedAt: new Date(), onboardingStep: Math.max(shop.onboardingStep, 5) };
  for (const key of ["logoUrl", "coverUrl"] as const) {
    const v = input[key];
    if (v === undefined) continue;
    if (v !== null && !isOwnMediaUrl(v)) throw errors.validation("Upload images through Locafy.");
    patch[key] = v;
  }
  await getDb().update(shops).set(patch).where(eq(shops.id, shopId));
}

/** Only URLs produced by the storage module may be attached to records. */
export function isOwnMediaUrl(url: string): boolean {
  if (url.startsWith("/media/")) return true;
  const host = process.env.STORAGE_PUBLIC_HOST;
  return Boolean(host) && url.startsWith(`https://${host}/`);
}

/** Create or update the primary branch (onboarding step 2). */
export async function savePrimaryBranch(ctx: Ctx, shopId: string, input: unknown) {
  const { shop } = await loadEditable(ctx, shopId);
  const data = parseInput(branchSchema, input);
  const db = getDb();
  const country = process.env.DEFAULT_COUNTRY_CODE ?? "in";
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.shopId, shopId), eq(branches.isPrimary, true)))
      .limit(1);
    const values = {
      name: data.name ?? "Main store",
      addressLine: data.addressLine,
      locality: data.locality ?? null,
      city: data.city,
      region: data.region ?? null,
      postalCode: data.postalCode ?? null,
      countryCode: country,
      location: { lat: data.lat, lng: data.lng },
      phone: data.phone ?? null,
      updatedAt: new Date(),
    };
    if (existing[0]) {
      await tx.update(branches).set(values).where(eq(branches.id, existing[0].id));
    } else {
      await tx.insert(branches).values({ ...values, shopId, isPrimary: true });
    }
    await tx
      .update(shops)
      .set({ onboardingStep: Math.max(shop.onboardingStep, 3), updatedAt: new Date() })
      .where(eq(shops.id, shopId));
  });
}

export async function addBranch(ctx: Ctx, shopId: string, input: unknown) {
  await loadEditable(ctx, shopId);
  const data = parseInput(branchSchema, input);
  const db = getDb();
  return db.transaction(async (tx) => {
    await assertWithinLimit(tx, shopId, "maxBranches");
    const [b] = await tx
      .insert(branches)
      .values({
        shopId,
        name: data.name ?? data.city,
        addressLine: data.addressLine,
        locality: data.locality ?? null,
        city: data.city,
        region: data.region ?? null,
        postalCode: data.postalCode ?? null,
        countryCode: process.env.DEFAULT_COUNTRY_CODE ?? "in",
        location: { lat: data.lat, lng: data.lng },
        phone: data.phone ?? null,
        isPrimary: false,
      })
      .returning({ id: branches.id });
    await audit(tx, ctx, { action: "branch.create", targetType: "shop", targetId: shopId });
    return b!;
  });
}

export async function submitVerification(ctx: Ctx, shopId: string, input: unknown) {
  const { shop } = await loadEditable(ctx, shopId, "shop.submit");
  const data = parseInput(verificationSchema, input);
  if (!["draft", "rejected"].includes(shop.status)) {
    throw errors.invalidState("This shop has already been submitted.");
  }
  const db = getDb();
  const missing = await onboardingGaps(shopId);
  if (missing.length) {
    throw errors.validation(`Complete these steps before submitting: ${missing.join(", ")}.`, { _form: missing });
  }
  await db.transaction(async (tx) => {
    await tx
      .update(shops)
      .set({
        verificationNote: data.verificationNote,
        status: "pending",
        statusReason: null,
        submittedAt: new Date(),
        onboardingStep: 6,
        updatedAt: new Date(),
      })
      .where(and(eq(shops.id, shopId), inArray(shops.status, ["draft", "rejected"])));
    await audit(tx, ctx, { action: "shop.submit", targetType: "shop", targetId: shopId });
    const admins = await tx.select({ id: users.id }).from(users).where(inArray(users.platformRole, ["admin", "super_admin"]));
    for (const a of admins) {
      await notify(tx, { userId: a.id, type: "shop.pending", title: `New shop awaiting review: ${shop.name}`, link: `/admin/shops/${shopId}` });
    }
  });
}

/** Human-readable list of what still blocks submission. */
export async function onboardingGaps(shopId: string): Promise<string[]> {
  const db = getDb();
  const shop = await db.query.shops.findFirst({ where: eq(shops.id, shopId) });
  if (!shop) return ["shop details"];
  const branch = await db
    .select({ id: branches.id, lat: latSql(branches.location) })
    .from(branches)
    .where(and(eq(branches.shopId, shopId), eq(branches.isPrimary, true)))
    .limit(1);
  const gaps: string[] = [];
  if (!shop.categoryId) gaps.push("category");
  if (!branch[0] || branch[0].lat == null) gaps.push("address and map location");
  if (!shop.phone) gaps.push("contact phone");
  return gaps;
}

// ---------------------------------------------------------------------------
// Team members
// ---------------------------------------------------------------------------

export async function listMembers(ctx: Ctx, shopId: string) {
  await requireShopPermission(ctx, shopId, "shop.view");
  return getDb()
    .select({ userId: users.id, name: users.name, email: users.email, role: shopMembers.role, since: shopMembers.createdAt })
    .from(shopMembers)
    .innerJoin(users, eq(users.id, shopMembers.userId))
    .where(eq(shopMembers.shopId, shopId))
    .orderBy(asc(shopMembers.createdAt));
}

export async function addMember(ctx: Ctx, shopId: string, input: unknown) {
  const { shop } = await requireShopPermission(ctx, shopId, "shop.members");
  const data = parseInput(memberSchema, input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const target = await tx.query.users.findFirst({ where: and(eq(users.email, data.email), eq(users.status, "active")) });
    if (!target) {
      throw errors.validation("No active Locafy account uses that email. Ask them to sign up first.", {
        email: ["No active Locafy account uses that email."],
      });
    }
    const existing = await tx
      .select({ role: shopMembers.role })
      .from(shopMembers)
      .where(and(eq(shopMembers.shopId, shopId), eq(shopMembers.userId, target.id)));
    if (existing[0]) throw errors.conflict("That person is already a member of this shop.");
    await assertWithinLimit(tx, shopId, "maxStaff");
    await tx.insert(shopMembers).values({ shopId, userId: target.id, role: data.role });
    await audit(tx, ctx, { action: "shop.member_add", targetType: "shop", targetId: shopId, metadata: { userId: target.id, role: data.role } });
    await notify(tx, { userId: target.id, type: "shop.member_added", title: `You were added to ${shop.name} as ${data.role}`, link: `/merchant` });
  });
}

export async function removeMember(ctx: Ctx, shopId: string, userId: string) {
  await requireShopPermission(ctx, shopId, "shop.members");
  const db = getDb();
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(shopMembers)
      .where(and(eq(shopMembers.shopId, shopId), eq(shopMembers.userId, userId), ne(shopMembers.role, "owner")))
      .returning();
    if (!removed) throw errors.invalidState("That member cannot be removed.");
    await audit(tx, ctx, { action: "shop.member_remove", targetType: "shop", targetId: shopId, metadata: { userId } });
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function listMyShops(ctx: Ctx) {
  const user = requireUser(ctx);
  return getDb()
    .select({
      id: shops.id,
      name: shops.name,
      slug: shops.slug,
      status: shops.status,
      logoUrl: shops.logoUrl,
      role: shopMembers.role,
      onboardingStep: shops.onboardingStep,
    })
    .from(shopMembers)
    .innerJoin(shops, eq(shops.id, shopMembers.shopId))
    .where(eq(shopMembers.userId, user.id))
    .orderBy(asc(shops.createdAt));
}

export async function getMerchantShop(ctx: Ctx, shopId: string) {
  const { shop, role } = await requireShopPermission(ctx, shopId, "shop.view");
  const db = getDb();
  const branchRows = await db
    .select({
      id: branches.id,
      name: branches.name,
      isPrimary: branches.isPrimary,
      addressLine: branches.addressLine,
      locality: branches.locality,
      city: branches.city,
      region: branches.region,
      postalCode: branches.postalCode,
      phone: branches.phone,
      openingHours: branches.openingHours,
      isActive: branches.isActive,
      lat: latSql(branches.location),
      lng: lngSql(branches.location),
    })
    .from(branches)
    .where(eq(branches.shopId, shopId))
    .orderBy(sql`${branches.isPrimary} desc`, asc(branches.createdAt));
  return { shop, role, branches: branchRows };
}

export type PublicShop = Awaited<ReturnType<typeof getPublicShopBySlug>>;

/**
 * Public shop view. Only active shops are visible to the public; members and
 * admins may preview their own non-active shop.
 */
export async function getPublicShopBySlug(ctx: Ctx, slug: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: shops.id,
      slug: shops.slug,
      name: shops.name,
      description: shops.description,
      status: shops.status,
      isVerified: shops.isVerified,
      phone: shops.phone,
      whatsapp: shops.whatsapp,
      email: shops.email,
      website: shops.website,
      logoUrl: shops.logoUrl,
      coverUrl: shops.coverUrl,
      categoryName: categories.name,
      categorySlug: categories.slug,
      approvedAt: shops.approvedAt,
    })
    .from(shops)
    .leftJoin(categories, eq(categories.id, shops.categoryId))
    .where(eq(shops.slug, slug))
    .limit(1);
  const shop = rows[0];
  if (!shop) return null;
  if (shop.status !== "active") {
    const canPreview =
      isAdmin(ctx.actor) ||
      (ctx.actor &&
        (await db
          .select({ r: shopMembers.role })
          .from(shopMembers)
          .where(and(eq(shopMembers.shopId, shop.id), eq(shopMembers.userId, ctx.actor.id)))
          .limit(1))[0]);
    if (!canPreview) return null;
  }
  const branchRows = await db
    .select({
      id: branches.id,
      name: branches.name,
      isPrimary: branches.isPrimary,
      addressLine: branches.addressLine,
      locality: branches.locality,
      city: branches.city,
      postalCode: branches.postalCode,
      phone: branches.phone,
      openingHours: branches.openingHours,
      lat: latSql(branches.location),
      lng: lngSql(branches.location),
    })
    .from(branches)
    .where(and(eq(branches.shopId, shop.id), eq(branches.isActive, true)))
    .orderBy(sql`${branches.isPrimary} desc`);
  return { ...shop, branches: branchRows };
}

/** True when the signed-in user is a member (any role) of the shop. */
export async function isShopMember(ctx: Ctx, shopId: string): Promise<boolean> {
  if (!ctx.actor) return false;
  const rows = await getDb()
    .select({ r: shopMembers.role })
    .from(shopMembers)
    .where(and(eq(shopMembers.shopId, shopId), eq(shopMembers.userId, ctx.actor.id)))
    .limit(1);
  return rows.length > 0;
}
