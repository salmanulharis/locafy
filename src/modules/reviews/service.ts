import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { catalogProducts, reviews, shopMembers, shops, users } from "@/db/schema";
import { errors, isUniqueViolation } from "@/lib/errors";
import { parseInput, uuidSchema } from "@/lib/validation";
import { isAdmin, requireShopPermission, requireUser } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { notify } from "@/modules/notifications/service";
import { audit } from "@/modules/platform/audit";
import { enforceRateLimit } from "@/modules/platform/rate-limit";
import { publicName } from "@/modules/products/service";

export const reviewInputSchema = z.object({
  targetType: z.enum(["shop", "product"]),
  targetId: uuidSchema,
  rating: z.coerce.number().int().min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
  body: z
    .string()
    .trim()
    .max(2000, "Keep reviews under 2000 characters.")
    .refine((b) => b.length === 0 || b.length >= 10, "Write at least 10 characters, or leave the comment empty.")
    .optional(),
});

/** Reviews may be edited within this window; afterwards they can only be deleted. */
export const REVIEW_EDIT_WINDOW_DAYS = 30;

export function canEditReview(createdAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= REVIEW_EDIT_WINDOW_DAYS * 86_400_000;
}

/**
 * Create or update the caller's review for a shop or product (one per target).
 * Reviews are never labelled "verified purchase": Locafy has no purchase evidence.
 */
export async function upsertReview(ctx: Ctx, input: unknown) {
  const user = requireUser(ctx);
  const data = parseInput(reviewInputSchema, input);
  await enforceRateLimit("reviewWrite", user.id);
  const db = getDb();
  return db.transaction(async (tx) => {
    let shopName: string | null = null;
    let shopId: string | null = null;
    if (data.targetType === "shop") {
      const shop = await tx.query.shops.findFirst({ where: and(eq(shops.id, data.targetId), eq(shops.status, "active")) });
      if (!shop) throw errors.notFound("Shop");
      const member = await tx
        .select({ r: shopMembers.role })
        .from(shopMembers)
        .where(and(eq(shopMembers.shopId, shop.id), eq(shopMembers.userId, user.id)));
      if (member[0]) throw errors.forbidden("You cannot review a shop you work for.");
      shopName = shop.name;
      shopId = shop.id;
    } else {
      const p = await tx.query.catalogProducts.findFirst({
        where: and(eq(catalogProducts.id, data.targetId), eq(catalogProducts.status, "active")),
      });
      if (!p) throw errors.notFound("Product");
    }
    const targetCond =
      data.targetType === "shop" ? eq(reviews.shopId, data.targetId) : eq(reviews.catalogProductId, data.targetId);
    const existing = await tx.query.reviews.findFirst({ where: and(eq(reviews.authorId, user.id), targetCond) });
    if (existing) {
      if (existing.status === "removed") throw errors.forbidden("This review was removed by a moderator and cannot be edited.");
      if (!canEditReview(existing.createdAt)) {
        throw errors.invalidState(`Reviews can be edited for ${REVIEW_EDIT_WINDOW_DAYS} days. You can delete it and write a new one.`);
      }
      await tx
        .update(reviews)
        .set({ rating: data.rating, body: data.body || null, updatedAt: new Date() })
        .where(eq(reviews.id, existing.id));
      return { id: existing.id, created: false };
    }
    try {
      const [r] = await tx
        .insert(reviews)
        .values({
          authorId: user.id,
          targetType: data.targetType,
          shopId: data.targetType === "shop" ? data.targetId : null,
          catalogProductId: data.targetType === "product" ? data.targetId : null,
          rating: data.rating,
          body: data.body || null,
        })
        .returning({ id: reviews.id });
      if (shopId) {
        const owners = await tx
          .select({ userId: shopMembers.userId })
          .from(shopMembers)
          .where(and(eq(shopMembers.shopId, shopId), eq(shopMembers.role, "owner")));
        for (const o of owners) {
          await notify(tx, {
            userId: o.userId,
            type: "review.new",
            title: `New ${data.rating}★ review for ${shopName}`,
            link: `/merchant/${shopId}/reviews`,
            emailPref: "emailReviews",
          });
        }
      }
      return { id: r!.id, created: true };
    } catch (e) {
      if (isUniqueViolation(e)) throw errors.conflict("You have already reviewed this.");
      throw e;
    }
  });
}

export async function deleteReview(ctx: Ctx, reviewId: string) {
  const user = requireUser(ctx);
  parseInput(uuidSchema, reviewId);
  const db = getDb();
  const r = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) });
  if (!r || r.authorId !== user.id) throw errors.notFound("Review");
  await db.delete(reviews).where(eq(reviews.id, reviewId));
}

const responseSchema = z.object({ response: z.string().trim().min(2, "Write a response.").max(1000) });

export async function respondToReview(ctx: Ctx, reviewId: string, input: unknown) {
  parseInput(uuidSchema, reviewId);
  const { response } = parseInput(responseSchema, input);
  const db = getDb();
  const r = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId) });
  if (!r || r.targetType !== "shop" || !r.shopId) throw errors.notFound("Review");
  await requireShopPermission(ctx, r.shopId, "review.respond");
  await db.transaction(async (tx) => {
    await tx
      .update(reviews)
      .set({ merchantResponse: response, merchantRespondedAt: new Date() })
      .where(eq(reviews.id, reviewId));
    await audit(tx, ctx, { action: "review.respond", targetType: "review", targetId: reviewId });
  });
}

export async function listShopReviews(ctx: Ctx, shopId: string, opts: { includeHidden?: boolean } = {}) {
  const db = getDb();
  const showHidden = opts.includeHidden && (isAdmin(ctx.actor) || (ctx.actor && (await canSeeHidden(ctx, shopId))));
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      merchantResponse: reviews.merchantResponse,
      merchantRespondedAt: reviews.merchantRespondedAt,
      authorId: reviews.authorId,
      authorName: users.name,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.authorId))
    .where(and(eq(reviews.shopId, shopId), showHidden ? undefined : eq(reviews.status, "published")))
    .orderBy(desc(reviews.createdAt))
    .limit(50);
  const summary = await db
    .select({ avg: sql<number | null>`round(avg(${reviews.rating})::numeric, 1)::float8`, n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.shopId, shopId), eq(reviews.status, "published")));
  return {
    average: summary[0]?.avg ?? null,
    count: summary[0]?.n ?? 0,
    items: rows.map((r) => ({ ...r, authorName: publicName(r.authorName) })),
  };
}

async function canSeeHidden(ctx: Ctx, shopId: string) {
  try {
    await requireShopPermission(ctx, shopId, "review.respond");
    return true;
  } catch {
    return false;
  }
}

export async function myReviewFor(ctx: Ctx, targetType: "shop" | "product", targetId: string) {
  if (!ctx.actor) return null;
  const cond = targetType === "shop" ? eq(reviews.shopId, targetId) : eq(reviews.catalogProductId, targetId);
  return (await getDb().query.reviews.findFirst({ where: and(eq(reviews.authorId, ctx.actor.id), cond) })) ?? null;
}

/** Merchant view of a shop's reviews, including hidden ones (owner/manager). */
export async function listShopReviewsForMerchant(ctx: Ctx, shopId: string) {
  await requireShopPermission(ctx, shopId, "review.respond");
  return listShopReviews(ctx, shopId, { includeHidden: true });
}

/** The caller's own reviews (any status), newest first. */
export async function listMyReviews(ctx: Ctx) {
  const user = requireUser(ctx);
  return getDb()
    .select({
      id: reviews.id,
      targetType: reviews.targetType,
      shopId: reviews.shopId,
      catalogProductId: reviews.catalogProductId,
      rating: reviews.rating,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
      merchantResponse: reviews.merchantResponse,
      merchantRespondedAt: reviews.merchantRespondedAt,
      shopName: shops.name,
      shopSlug: shops.slug,
      productName: catalogProducts.name,
      productSlug: catalogProducts.slug,
    })
    .from(reviews)
    .leftJoin(shops, eq(shops.id, reviews.shopId))
    .leftJoin(catalogProducts, eq(catalogProducts.id, reviews.catalogProductId))
    .where(eq(reviews.authorId, user.id))
    .orderBy(desc(reviews.createdAt))
    .limit(100);
}
