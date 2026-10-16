import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { branches, inventory, inventoryHistory, listings } from "@/db/schema";
import { errors } from "@/lib/errors";
import { moneySchema, parseInput, uuidSchema } from "@/lib/validation";
import { requireShopPermission } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { audit } from "@/modules/platform/audit";
import { applyQuantityChange, deriveStockStatus, STOCK_STATUSES_INPUT, type StockStatus } from "./rules";

export const inventoryUpdateSchema = z
  .object({
    price: moneySchema.optional(),
    /** Pass null to clear the MRP. */
    mrp: z.union([moneySchema, z.null()]).optional(),
    quantity: z.coerce.number().int("Use a whole number.").optional(),
    adjust: z.coerce.number().int("Use a whole number.").optional(),
    /** Stop tracking an exact quantity. */
    untrackQuantity: z.boolean().optional(),
    stockStatus: z.enum(STOCK_STATUSES_INPUT).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).max(10_000).optional(),
    /** Optimistic concurrency: reject if the row changed since the client read it. */
    expectedVersion: z.coerce.number().int().optional(),
    /** Confirms stock is unchanged ("still accurate") and refreshes the timestamp. */
    confirm: z.boolean().optional(),
  })
  .refine((v) => !(v.quantity !== undefined && v.adjust !== undefined), {
    message: "Set a quantity or adjust it, not both.",
    path: ["adjust"],
  })
  .refine((v) => v.price === undefined || v.price > 0, { message: "Price must be greater than zero.", path: ["price"] });

/**
 * Update price and/or stock for one branch inventory row.
 * Runs in a transaction with a row lock so concurrent updates serialise and the
 * history log always matches the final state.
 */
export async function updateInventory(ctx: Ctx, inventoryId: string, input: unknown) {
  parseInput(uuidSchema, inventoryId);
  const data = parseInput(inventoryUpdateSchema, input);
  const db = getDb();
  return db.transaction(async (tx) => {
    const owner = await tx
      .select({ shopId: listings.shopId })
      .from(inventory)
      .innerJoin(listings, eq(listings.id, inventory.listingId))
      .where(eq(inventory.id, inventoryId))
      .limit(1);
    if (!owner[0]) throw errors.notFound("Inventory record");
    const { user, shop } = await requireShopPermission(ctx, owner[0].shopId, "inventory.update", tx);
    if (shop.status === "suspended") throw errors.invalidState("This shop is suspended. Inventory changes are disabled.");

    const [cur] = await tx.select().from(inventory).where(eq(inventory.id, inventoryId)).for("update");
    if (!cur) throw errors.notFound("Inventory record");
    if (data.expectedVersion !== undefined && data.expectedVersion !== cur.version) {
      throw errors.conflict("This item was updated by someone else. Refresh to see the latest values.");
    }

    let quantity = cur.quantity;
    try {
      if (data.untrackQuantity) quantity = null;
      else if (data.quantity !== undefined) quantity = applyQuantityChange(cur.quantity, { mode: "set", value: data.quantity });
      else if (data.adjust !== undefined) quantity = applyQuantityChange(cur.quantity, { mode: "adjust", delta: data.adjust });
    } catch (e) {
      throw errors.validation((e as Error).message, { quantity: [(e as Error).message] });
    }

    const price = data.price ?? cur.priceMinor;
    const mrp = data.mrp === undefined ? cur.mrpMinor : data.mrp;
    if (mrp != null && mrp < price) {
      throw errors.validation("MRP cannot be lower than the selling price.", { mrp: ["MRP cannot be lower than the selling price."] });
    }
    const threshold = data.lowStockThreshold ?? cur.lowStockThreshold;
    const explicit: StockStatus | undefined = data.stockStatus ?? (cur.stockStatus as StockStatus);
    const status = deriveStockStatus(quantity, threshold, explicit);

    const priceChanged = price !== cur.priceMinor || mrp !== cur.mrpMinor;
    const stockChanged = quantity !== cur.quantity || status !== cur.stockStatus || threshold !== cur.lowStockThreshold;
    if (!priceChanged && !stockChanged && !data.confirm) {
      return { inventory: cur, changed: false };
    }

    const now = new Date();
    const [updated] = await tx
      .update(inventory)
      .set({
        priceMinor: price,
        mrpMinor: mrp,
        quantity,
        stockStatus: status,
        lowStockThreshold: threshold,
        priceUpdatedAt: priceChanged ? now : cur.priceUpdatedAt,
        // Any explicit stock touch (including "confirm") refreshes freshness.
        stockUpdatedAt: stockChanged || data.confirm ? now : cur.stockUpdatedAt,
        version: sql`${inventory.version} + 1`,
      })
      .where(eq(inventory.id, inventoryId))
      .returning();

    await tx.insert(inventoryHistory).values({
      inventoryId,
      changedBy: user.id,
      source: ctx.authMethod === "bearer" ? "api" : "manual",
      oldPriceMinor: cur.priceMinor,
      newPriceMinor: price,
      oldQuantity: cur.quantity,
      newQuantity: quantity,
      oldStockStatus: cur.stockStatus,
      newStockStatus: status,
    });
    await tx.update(listings).set({ updatedAt: now }).where(eq(listings.id, cur.listingId));
    return { inventory: updated!, changed: true };
  });
}

const addStockSchema = z.object({
  branchId: uuidSchema,
  price: moneySchema,
  quantity: z.coerce.number().int().min(0).optional(),
  stockStatus: z.enum(STOCK_STATUSES_INPUT).optional(),
});

/** Start stocking an existing listing at another branch. */
export async function addBranchInventory(ctx: Ctx, listingId: string, input: unknown) {
  const data = parseInput(addStockSchema, input);
  const db = getDb();
  return db.transaction(async (tx) => {
    const l = await tx.query.listings.findFirst({ where: eq(listings.id, listingId) });
    if (!l) throw errors.notFound("Listing");
    const { user, shop } = await requireShopPermission(ctx, l.shopId, "listing.manage", tx);
    if (shop.status === "suspended") throw errors.invalidState("This shop is suspended. Inventory changes are disabled.");
    const b = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, data.branchId), eq(branches.shopId, l.shopId)));
    if (!b[0]) throw errors.validation("That branch is not part of this shop.");
    const status = deriveStockStatus(data.quantity ?? null, 3, data.stockStatus);
    const [row] = await tx
      .insert(inventory)
      .values({
        listingId,
        branchId: data.branchId,
        priceMinor: data.price,
        currency: process.env.DEFAULT_CURRENCY ?? "INR",
        quantity: data.quantity ?? null,
        stockStatus: status,
      })
      .onConflictDoNothing()
      .returning({ id: inventory.id });
    if (!row) throw errors.conflict("This branch already stocks the product.");
    await tx.insert(inventoryHistory).values({
      inventoryId: row.id,
      changedBy: user.id,
      newPriceMinor: data.price,
      newQuantity: data.quantity ?? null,
      newStockStatus: status,
    });
    await audit(tx, ctx, { action: "inventory.add_branch", targetType: "listing", targetId: listingId });
    return row;
  });
}
