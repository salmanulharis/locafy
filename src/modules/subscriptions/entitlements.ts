import { and, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { branches, listings, mediaAssets, offers, plans, shopMembers, subscriptions, type Entitlements } from "@/db/schema";
import { errors } from "@/lib/errors";

/** Used only if the database has no default plan (misconfiguration safety net). */
export const FALLBACK_ENTITLEMENTS: Entitlements = {
  maxListings: 25,
  maxStorageMb: 50,
  maxBranches: 1,
  maxStaff: 1,
  maxActiveOffers: 2,
  advancedAnalytics: false,
  bulkImport: false,
  promotionScheduling: false,
  sponsoredPlacements: false,
};

export type NumericLimit = "maxListings" | "maxStorageMb" | "maxBranches" | "maxStaff" | "maxActiveOffers";
export type FeatureFlag = "advancedAnalytics" | "bulkImport" | "promotionScheduling" | "sponsoredPlacements";

export const LIMIT_LABELS: Record<NumericLimit, string> = {
  maxListings: "product listings",
  maxStorageMb: "MB of media storage",
  maxBranches: "branches",
  maxStaff: "team members",
  maxActiveOffers: "active offers",
};

/** Subscription statuses that grant the plan's entitlements. */
export const ENTITLED_STATUSES = ["active", "trialing", "past_due"] as const;

/** Pure check, unit-tested. `-1` means unlimited. */
export function isWithinLimit(ent: Entitlements, key: NumericLimit, nextValue: number): boolean {
  const max = ent[key];
  return max < 0 || nextValue <= max;
}

export function mergeEntitlements(partial: Partial<Entitlements> | null | undefined): Entitlements {
  return { ...FALLBACK_ENTITLEMENTS, ...(partial ?? {}) };
}

export async function getShopPlan(tx: Tx, shopId: string) {
  const live = await tx
    .select({ plan: plans, subscription: subscriptions })
    .from(subscriptions)
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .where(and(eq(subscriptions.shopId, shopId), inArray(subscriptions.status, [...ENTITLED_STATUSES])))
    .limit(1);
  if (live[0]) return { plan: live[0].plan, subscription: live[0].subscription };
  const def = await tx.select().from(plans).where(eq(plans.isDefault, true)).limit(1);
  return { plan: def[0] ?? null, subscription: null };
}

export async function getShopEntitlements(tx: Tx, shopId: string): Promise<Entitlements> {
  const { plan } = await getShopPlan(tx, shopId);
  return mergeEntitlements(plan?.entitlements);
}

export async function currentUsage(tx: Tx, shopId: string): Promise<Record<NumericLimit, number>> {
  const [l, b, s, m, o] = await Promise.all([
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(and(eq(listings.shopId, shopId), inArray(listings.status, ["draft", "published", "unpublished"]))),
    tx.select({ n: sql<number>`count(*)::int` }).from(branches).where(and(eq(branches.shopId, shopId), eq(branches.isActive, true))),
    tx.select({ n: sql<number>`count(*)::int` }).from(shopMembers).where(eq(shopMembers.shopId, shopId)),
    tx.select({ n: sql<number>`coalesce(sum(bytes),0)::bigint` }).from(mediaAssets).where(eq(mediaAssets.shopId, shopId)),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(offers)
      .where(and(eq(offers.shopId, shopId), eq(offers.status, "published"), sql`${offers.endsAt} > now()`)),
  ]);
  return {
    maxListings: l[0]?.n ?? 0,
    maxBranches: b[0]?.n ?? 0,
    maxStaff: s[0]?.n ?? 0,
    maxStorageMb: Math.ceil(Number(m[0]?.n ?? 0) / (1024 * 1024)),
    maxActiveOffers: o[0]?.n ?? 0,
  };
}

/**
 * Throw LIMIT_EXCEEDED if adding `increment` units of `key` would exceed the
 * shop's plan. For storage, pass the increment in bytes via `incrementBytes`.
 */
export async function assertWithinLimit(
  tx: Tx,
  shopId: string,
  key: NumericLimit,
  opts: { increment?: number; incrementBytes?: number } = {},
) {
  const ent = await getShopEntitlements(tx, shopId);
  if (ent[key] < 0) return;
  let next: number;
  if (key === "maxStorageMb") {
    const rows = await tx
      .select({ n: sql<number>`coalesce(sum(bytes),0)::bigint` })
      .from(mediaAssets)
      .where(eq(mediaAssets.shopId, shopId));
    next = (Number(rows[0]?.n ?? 0) + (opts.incrementBytes ?? 0)) / (1024 * 1024);
  } else {
    const usage = await currentUsage(tx, shopId);
    next = usage[key] + (opts.increment ?? 1);
  }
  if (!isWithinLimit(ent, key, next)) {
    throw errors.limit(
      `Your current plan allows up to ${ent[key]} ${LIMIT_LABELS[key]}. Upgrade your plan or free up capacity to continue.`,
      { limit: key, max: ent[key] },
    );
  }
}

export async function assertFeature(tx: Tx, shopId: string, feature: FeatureFlag, label: string) {
  const ent = await getShopEntitlements(tx, shopId);
  if (!ent[feature]) throw errors.limit(`${label} is not included in your current plan.`, { feature });
}
