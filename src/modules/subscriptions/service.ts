import { getDb } from "@/db/client";
import { requireShopPermission } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { currentUsage, getShopPlan, LIMIT_LABELS, mergeEntitlements } from "./entitlements";

/**
 * The shop's current plan, effective entitlements and usage against each
 * numeric limit (owner only). `-1` limits mean unlimited.
 */
export async function getShopSubscription(ctx: Ctx, shopId: string) {
  await requireShopPermission(ctx, shopId, "subscription.view");
  const db = getDb();
  const [{ plan, subscription }, usage] = await Promise.all([getShopPlan(db, shopId), currentUsage(db, shopId)]);
  const entitlements = mergeEntitlements(plan?.entitlements);
  return {
    plan: plan
      ? {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          description: plan.description,
          priceMinor: plan.priceMinor,
          currency: plan.currency,
          interval: plan.interval,
          isDefault: plan.isDefault,
        }
      : null,
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          provider: subscription.provider,
          currentPeriodEnd: subscription.currentPeriodEnd,
          createdAt: subscription.createdAt,
        }
      : null,
    entitlements,
    usage: (Object.keys(LIMIT_LABELS) as (keyof typeof LIMIT_LABELS)[]).map((key) => ({
      key,
      label: LIMIT_LABELS[key],
      used: usage[key],
      max: entitlements[key],
    })),
  };
}
