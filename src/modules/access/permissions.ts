import { and, eq } from "drizzle-orm";
import { getDb, type Tx } from "@/db/client";
import { shopMembers, shops } from "@/db/schema";
import { errors } from "@/lib/errors";
import type { Ctx } from "@/modules/auth/context";
import type { SessionUser } from "@/modules/auth/sessions";

export type ShopRole = "owner" | "manager" | "staff";

/**
 * Shop-level permission matrix. This is the only place that maps roles to
 * capabilities; UI visibility is derived from it but never replaces it.
 */
export const SHOP_PERMISSIONS = {
  "shop.view": ["owner", "manager", "staff"],
  "shop.edit": ["owner", "manager"],
  "shop.submit": ["owner"],
  "shop.members": ["owner"],
  "listing.manage": ["owner", "manager"],
  "inventory.update": ["owner", "manager", "staff"],
  "offer.manage": ["owner", "manager"],
  "enquiry.respond": ["owner", "manager", "staff"],
  "review.respond": ["owner", "manager"],
  "analytics.view": ["owner", "manager"],
  "subscription.view": ["owner"],
  "media.upload": ["owner", "manager"],
} as const satisfies Record<string, readonly ShopRole[]>;

export type ShopPermission = keyof typeof SHOP_PERMISSIONS;

export function roleAllows(role: ShopRole | null | undefined, permission: ShopPermission): boolean {
  if (!role) return false;
  return (SHOP_PERMISSIONS[permission] as readonly ShopRole[]).includes(role);
}

export function requireUser(ctx: Ctx): SessionUser {
  if (!ctx.actor) throw errors.unauthenticated();
  if (ctx.actor.status !== "active") throw errors.forbidden("Your account is not active.");
  return ctx.actor;
}

export function isAdmin(user: SessionUser | null | undefined): boolean {
  return user?.platformRole === "admin" || user?.platformRole === "super_admin";
}

export function requireAdmin(ctx: Ctx): SessionUser {
  const user = requireUser(ctx);
  if (!isAdmin(user)) throw errors.forbidden();
  return user;
}

export function requireSuperAdmin(ctx: Ctx): SessionUser {
  const user = requireUser(ctx);
  if (user.platformRole !== "super_admin") throw errors.forbidden("Only a super administrator can do that.");
  return user;
}

export async function getShopRole(tx: Tx, userId: string, shopId: string): Promise<ShopRole | null> {
  const rows = await tx
    .select({ role: shopMembers.role })
    .from(shopMembers)
    .where(and(eq(shopMembers.userId, userId), eq(shopMembers.shopId, shopId)))
    .limit(1);
  return rows[0]?.role ?? null;
}

/**
 * Ensure the caller holds `permission` on `shopId`. Platform admins are NOT
 * implicitly granted merchant permissions; admin operations go through the
 * administration module with their own checks and audit trail.
 *
 * Responds NOT_FOUND (not FORBIDDEN) to non-members so shop existence and
 * private identifiers are not disclosed.
 */
export async function requireShopPermission(
  ctx: Ctx,
  shopId: string,
  permission: ShopPermission,
  tx: Tx = getDb(),
): Promise<{ user: SessionUser; role: ShopRole; shop: typeof shops.$inferSelect }> {
  const user = requireUser(ctx);
  const rows = await tx
    .select({ shop: shops, role: shopMembers.role })
    .from(shops)
    .innerJoin(shopMembers, and(eq(shopMembers.shopId, shops.id), eq(shopMembers.userId, user.id)))
    .where(eq(shops.id, shopId))
    .limit(1);
  const row = rows[0];
  if (!row) throw errors.notFound("Shop");
  if (!roleAllows(row.role, permission)) {
    throw errors.forbidden("Your role in this shop does not allow that action.");
  }
  return { user, role: row.role, shop: row.shop };
}
