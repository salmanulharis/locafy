import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { plans } from "@/db/schema";
import { requireShopPermission } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { currentUsage, getShopPlan, mergeEntitlements } from "./entitlements";

/**
 * Read-only plan information for the merchant UI. Usage vs limits is visible to
 * every member (it explains why an action is blocked); billing details and the
 * plan catalogue are owner-only ("subscription.view").
 */
export async function getPlanUsage(ctx: Ctx, shopId: string) {
  await requireShopPermission(ctx, shopId, "shop.view");
  const db = getDb();
  const [{ plan }, usage] = await Promise.all([getShopPlan(db, shopId), currentUsage(db, shopId)]);
  return {
    planName: plan?.name ?? "Free",
    entitlements: mergeEntitlements(plan?.entitlements),
    usage,
  };
}

export async function getPlanOverview(ctx: Ctx, shopId: string) {
  await requireShopPermission(ctx, shopId, "subscription.view");
  const db = getDb();
  const [{ plan, subscription }, usage, available] = await Promise.all([
    getShopPlan(db, shopId),
    currentUsage(db, shopId),
    listActivePlans(),
  ]);
  return {
    plan,
    subscription: subscription
      ? { status: subscription.status, provider: subscription.provider, currentPeriodEnd: subscription.currentPeriodEnd }
      : null,
    entitlements: mergeEntitlements(plan?.entitlements),
    usage,
    plans: available,
  };
}

/** Active plans offered on Locafy (public catalogue, no private fields). */
export async function listActivePlans() {
  return getDb()
    .select({
      id: plans.id,
      code: plans.code,
      name: plans.name,
      description: plans.description,
      priceMinor: plans.priceMinor,
      currency: plans.currency,
      interval: plans.interval,
      entitlements: plans.entitlements,
      isDefault: plans.isDefault,
    })
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder), asc(plans.priceMinor));
}
