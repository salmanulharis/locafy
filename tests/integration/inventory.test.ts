import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { inventory, inventoryHistory } from "@/db/schema";
import { assignPlan } from "@/modules/administration/service";
import { addBranchInventory, updateInventory } from "@/modules/inventory/service";
import { createListing } from "@/modules/listings/service";
import { addBranch, addMember } from "@/modules/shops/service";
import {
  categoryId,
  createActiveShop,
  createAdmin,
  createListingFor,
  createUser,
  ctxOf,
  expectCode,
  inventoryRow,
  north,
  planId,
  truncateAll,
} from "./helpers";

beforeEach(truncateAll);

const A55 = { name: "Samsung Galaxy A55 5G", brand: "Samsung", model: "Galaxy A55", variant: "8GB / 128GB" };

async function setup(quantity = 10) {
  const admin = await createAdmin();
  const ownerA = await createUser({ name: "Owner A" });
  const ownerB = await createUser({ name: "Owner B" });
  const a = await createActiveShop(ownerA, admin, { name: "Shop A" });
  const b = await createActiveShop(ownerB, admin, { name: "Shop B", at: north(3) });
  const la = await createListingFor(ownerA, a.shop.id, a.branchId, A55, { price: "39999", quantity });
  const lb = await createListingFor(ownerB, b.shop.id, b.branchId, A55, { price: "38999", quantity });
  return { admin, ownerA, ownerB, a, b, la, lb, invA: await inventoryRow(la.id), invB: await inventoryRow(lb.id) };
}

const history = (inventoryId: string) =>
  getDb().select().from(inventoryHistory).where(eq(inventoryHistory.inventoryId, inventoryId)).orderBy(asc(inventoryHistory.id));

describe("inventory updates", () => {
  it("price update by shop A does not affect shop B's price for the same catalogue product", async () => {
    const { ownerA, la, lb, invA } = await setup();
    expect(la.catalogProductId).toBe(lb.catalogProductId);
    const r = await updateInventory(ctxOf(ownerA), invA.id, { price: "37,499.50" });
    expect(r.changed).toBe(true);
    expect((await inventoryRow(la.id)).priceMinor).toBe(3_749_950);
    expect((await inventoryRow(lb.id)).priceMinor).toBe(3_899_900);
  });

  it("branch isolation: each branch keeps its own price and stock", async () => {
    const { admin, ownerA, a, la, invA } = await setup();
    await assignPlan(ctxOf(admin), a.shop.id, { planId: await planId("starter") });
    const branch2 = await addBranch(ctxOf(ownerA), a.shop.id, { name: "Kakkanad", addressLine: "Seaport Road", city: "Kochi", lat: 10.0159, lng: 76.3419 });
    await addBranchInventory(ctxOf(ownerA), la.id, { branchId: branch2.id, price: "40999", quantity: 2 });
    await expectCode(addBranchInventory(ctxOf(ownerA), la.id, { branchId: branch2.id, price: "1" }), "CONFLICT");

    await updateInventory(ctxOf(ownerA), invA.id, { price: "35000", quantity: 1 });
    const b1 = await inventoryRow(la.id, a.branchId);
    const b2 = await inventoryRow(la.id, branch2.id);
    expect([b1.priceMinor, b1.quantity, b1.stockStatus]).toEqual([3_500_000, 1, "low_stock"]);
    expect([b2.priceMinor, b2.quantity, b2.stockStatus]).toEqual([4_099_900, 2, "low_stock"]);
  });

  it("rejects negative, fractional and both-mode quantity changes", async () => {
    const { ownerA, invA } = await setup(3);
    const ctx = ctxOf(ownerA);
    const e = await expectCode(updateInventory(ctx, invA.id, { quantity: -1 }), "VALIDATION_ERROR");
    expect(e.fieldErrors?.quantity?.[0]).toMatch(/below zero/);
    await expectCode(updateInventory(ctx, invA.id, { adjust: -4 }), "VALIDATION_ERROR");
    await expectCode(updateInventory(ctx, invA.id, { quantity: "1.5" }), "VALIDATION_ERROR");
    await expectCode(updateInventory(ctx, invA.id, { quantity: 5, adjust: 1 }), "VALIDATION_ERROR");
    await expectCode(updateInventory(ctx, invA.id, { quantity: 2_000_000 }), "VALIDATION_ERROR");
    await expectCode(updateInventory(ctx, invA.id, { price: "0" }), "VALIDATION_ERROR");
    await expectCode(updateInventory(ctx, invA.id, { mrp: "100" }), "VALIDATION_ERROR"); // below price
    expect((await inventoryRow(invA.listingId)).quantity).toBe(3);
  });

  it("writes history rows with old and new values", async () => {
    const { ownerA, invA } = await setup(10);
    await updateInventory(ctxOf(ownerA), invA.id, { price: "38000", adjust: -7 });
    const h = await history(invA.id);
    expect(h).toHaveLength(2); // creation + update
    expect(h[1]).toMatchObject({
      oldPriceMinor: 3_999_900,
      newPriceMinor: 3_800_000,
      oldQuantity: 10,
      newQuantity: 3,
      oldStockStatus: "in_stock",
      newStockStatus: "low_stock",
      changedBy: ownerA.id,
      source: "api",
    });
    // A no-op update writes nothing.
    const noop = await updateInventory(ctxOf(ownerA), invA.id, { price: "38000" });
    expect(noop.changed).toBe(false);
    expect(await history(invA.id)).toHaveLength(2);
    // "Confirm still accurate" refreshes freshness and is recorded.
    const before = (await inventoryRow(invA.listingId)).stockUpdatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await updateInventory(ctxOf(ownerA), invA.id, { confirm: true });
    expect((await inventoryRow(invA.listingId)).stockUpdatedAt.getTime()).toBeGreaterThan(before.getTime());
    expect(await history(invA.id)).toHaveLength(3);
  });

  it("untracking quantity keeps an explicit status; MRP can be cleared", async () => {
    const { ownerA, invA } = await setup(0);
    expect(invA.stockStatus).toBe("out_of_stock");
    await updateInventory(ctxOf(ownerA), invA.id, { untrackQuantity: true, stockStatus: "in_stock", mrp: "45000" });
    let row = await inventoryRow(invA.listingId);
    expect([row.quantity, row.stockStatus, row.mrpMinor]).toEqual([null, "in_stock", 4_500_000]);
    await updateInventory(ctxOf(ownerA), invA.id, { mrp: null });
    row = await inventoryRow(invA.listingId);
    expect(row.mrpMinor).toBeNull();
  });

  it("expectedVersion mismatch -> CONFLICT", async () => {
    const { ownerA, invA } = await setup();
    expect(invA.version).toBe(1);
    await updateInventory(ctxOf(ownerA), invA.id, { price: "39000", expectedVersion: 1 });
    const e = await expectCode(updateInventory(ctxOf(ownerA), invA.id, { price: "38000", expectedVersion: 1 }), "CONFLICT");
    expect(e.message).toMatch(/updated by someone else/);
    const row = await inventoryRow(invA.listingId);
    expect([row.priceMinor, row.version]).toEqual([3_900_000, 2]);
  });

  it("concurrent adjustments serialise: 10 x adjust(-1) on 10 -> 0 with 10 history rows", async () => {
    const { ownerA, invA } = await setup(10);
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => updateInventory(ctxOf(ownerA), invA.id, { adjust: -1 })));
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    const row = await inventoryRow(invA.listingId);
    expect(row.quantity).toBe(0);
    expect(row.stockStatus).toBe("out_of_stock");
    expect(row.version).toBe(11);
    const h = await history(invA.id);
    expect(h).toHaveLength(11);
    // Every step is recorded exactly once: 10->9, 9->8, ... 1->0.
    expect(h.slice(1).map((x) => [x.oldQuantity, x.newQuantity])).toEqual(Array.from({ length: 10 }, (_, i) => [10 - i, 9 - i]));
    await expectCode(updateInventory(ctxOf(ownerA), invA.id, { adjust: -1 }), "VALIDATION_ERROR");
  });

  it("concurrent oversell: 15 x adjust(-1) on 10 -> exactly 10 succeed, never negative", async () => {
    const { ownerA, invA } = await setup(10);
    const results = await Promise.allSettled(Array.from({ length: 15 }, () => updateInventory(ctxOf(ownerA), invA.id, { adjust: -1 })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(5);
    for (const r of rejected) expect(r.reason.code).toBe("VALIDATION_ERROR");
    expect((await inventoryRow(invA.listingId)).quantity).toBe(0);
    expect(await history(invA.id)).toHaveLength(11);
  });

  it("concurrent expectedVersion writers: exactly one wins", async () => {
    const { ownerA, invA } = await setup(10);
    const results = await Promise.allSettled(
      ["30000", "31000", "32000", "33000", "34000"].map((price) => updateInventory(ctxOf(ownerA), invA.id, { price, expectedVersion: 1 })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason.code === "CONFLICT")).toBe(true);
    expect((await inventoryRow(invA.listingId)).version).toBe(2);
  });

  it("staff can update inventory but cannot create listings or add branch stock", async () => {
    const { ownerA, a, la, invA } = await setup();
    const staff = await createUser({ email: "staff@example.test" });
    await addMember(ctxOf(ownerA), a.shop.id, { email: "staff@example.test", role: "staff" });
    await updateInventory(ctxOf(staff), invA.id, { adjust: -2 });
    expect((await inventoryRow(la.id)).quantity).toBe(8);
    const h = await history(invA.id);
    expect(h.at(-1)?.changedBy).toBe(staff.id);

    await expectCode(
      createListing(ctxOf(staff), a.shop.id, {
        product: { name: "Pixel 8", brand: "Google", model: "Pixel 8", categoryId: await categoryId("smartphones") },
        stock: [{ branchId: a.branchId, price: "50000" }],
      }),
      "FORBIDDEN",
    );
    await expectCode(addBranchInventory(ctxOf(staff), la.id, { branchId: a.branchId, price: "1" }), "FORBIDDEN");
  });

  it("other merchants cannot touch the row (NOT_FOUND) and unknown ids are NOT_FOUND", async () => {
    const { ownerB, invA, la } = await setup();
    await expectCode(updateInventory(ctxOf(ownerB), invA.id, { price: "1" }), "NOT_FOUND");
    await expectCode(updateInventory(ctxOf(ownerB), "00000000-0000-4000-8000-000000000000", { price: "1" }), "NOT_FOUND");
    await expectCode(updateInventory(ctxOf(ownerB), "not-a-uuid", { price: "1" }), "VALIDATION_ERROR");
    await expectCode(updateInventory(ctxOf(null), invA.id, { price: "1" }), "UNAUTHENTICATED");
    const row = await getDb().query.inventory.findFirst({ where: eq(inventory.id, invA.id) });
    expect(row?.priceMinor).toBe(3_999_900);
    expect(la.id).toBeTruthy();
  });
});
