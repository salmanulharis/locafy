import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { mediaAssets, subscriptions } from "@/db/schema";
import { assignPlan } from "@/modules/administration/service";
import { changeListingStatus } from "@/modules/listings/service";
import { assertWithinLimit, currentUsage, getShopEntitlements, getShopPlan } from "@/modules/subscriptions/entitlements";
import { addMember } from "@/modules/shops/service";
import { createActiveShop, createAdmin, createListingFor, createUser, ctxOf, expectCode, planId, truncateAll } from "./helpers";

beforeEach(truncateAll);

const MB = 1024 * 1024;

async function setup() {
  const admin = await createAdmin();
  const owner = await createUser();
  const s = await createActiveShop(owner, admin);
  return { admin, owner, ...s };
}

const phone = (i: number) => ({ name: `Phone ${i}`, brand: "Acme", model: `Model ${i}` });

describe("plan limits", () => {
  it("free plan maxListings -> LIMIT_EXCEEDED on create and restore; archived don't count; upgrade allows", async () => {
    const { admin, owner, shop, branchId } = await setup();
    const ent = await getShopEntitlements(getDb(), shop.id);
    expect(ent.maxListings).toBe(25);
    const created: string[] = [];
    for (let i = 0; i < 25; i++) created.push((await createListingFor(owner, shop.id, branchId, phone(i), { publish: i % 2 === 0 })).id);
    expect((await currentUsage(getDb(), shop.id)).maxListings).toBe(25);

    const e = await expectCode(createListingFor(owner, shop.id, branchId, phone(25)), "LIMIT_EXCEEDED");
    expect(e.details).toEqual({ limit: "maxListings", max: 25 });
    expect(e.message).toMatch(/25 product listings/);

    // Archiving frees a slot.
    await changeListingStatus(ctxOf(owner), created[0]!, "archive");
    expect((await currentUsage(getDb(), shop.id)).maxListings).toBe(24);
    await createListingFor(owner, shop.id, branchId, phone(25));
    // Restoring the archived one would exceed the plan again.
    await expectCode(changeListingStatus(ctxOf(owner), created[0]!, "restore"), "LIMIT_EXCEEDED");

    await assignPlan(ctxOf(admin), shop.id, { planId: await planId("starter") });
    expect((await getShopEntitlements(getDb(), shop.id)).maxListings).toBe(200);
    await changeListingStatus(ctxOf(owner), created[0]!, "restore");
    await createListingFor(owner, shop.id, branchId, phone(26));
    expect((await currentUsage(getDb(), shop.id)).maxListings).toBe(27);
  });

  it("assignPlan replaces the live subscription; assigning free falls back to the default plan", async () => {
    const { admin, shop } = await setup();
    expect((await getShopPlan(getDb(), shop.id)).plan?.code).toBe("free");
    await assignPlan(ctxOf(admin), shop.id, { planId: await planId("starter") });
    await assignPlan(ctxOf(admin), shop.id, { planId: await planId("growth"), periodDays: 30 });
    const subs = await getDb().select().from(subscriptions).where(eq(subscriptions.shopId, shop.id));
    expect(subs.filter((s) => s.status === "active")).toHaveLength(1);
    expect((await getShopPlan(getDb(), shop.id)).plan?.code).toBe("growth");
    await assignPlan(ctxOf(admin), shop.id, { planId: await planId("free") });
    expect((await getShopPlan(getDb(), shop.id)).plan?.code).toBe("free");
    expect((await getShopPlan(getDb(), shop.id)).subscription).toBeNull();
  });

  it("unlimited (-1) plans never block", async () => {
    const { admin, shop } = await setup();
    await assignPlan(ctxOf(admin), shop.id, { planId: await planId("premium") });
    await assertWithinLimit(getDb(), shop.id, "maxListings", { increment: 1_000_000 });
    await assertWithinLimit(getDb(), shop.id, "maxActiveOffers", { increment: 1_000_000 });
  });

  it("storage limit uses bytes (assertWithinLimit maxStorageMb incrementBytes)", async () => {
    const { admin, owner, shop } = await setup();
    const db = getDb();
    await assertWithinLimit(db, shop.id, "maxStorageMb", { incrementBytes: 50 * MB });
    const e = await expectCode(assertWithinLimit(db, shop.id, "maxStorageMb", { incrementBytes: 50 * MB + 1 }), "LIMIT_EXCEEDED");
    expect(e.details).toEqual({ limit: "maxStorageMb", max: 50 });

    await db.insert(mediaAssets).values({ shopId: shop.id, uploadedBy: owner.id, storageKey: "shops/x/a.webp", url: "/media/shops/x/a.webp", mimeType: "image/webp", bytes: 40 * MB });
    await assertWithinLimit(db, shop.id, "maxStorageMb", { incrementBytes: 10 * MB });
    await expectCode(assertWithinLimit(db, shop.id, "maxStorageMb", { incrementBytes: 10 * MB + 1 }), "LIMIT_EXCEEDED");
    expect((await currentUsage(db, shop.id)).maxStorageMb).toBe(40);

    await assignPlan(ctxOf(admin), shop.id, { planId: await planId("starter") });
    await assertWithinLimit(db, shop.id, "maxStorageMb", { incrementBytes: 400 * MB });
  });

  it("free plan maxStaff counts the owner", async () => {
    const { owner, shop } = await setup();
    await createUser({ email: "s1@example.test" });
    await createUser({ email: "s2@example.test" });
    await addMember(ctxOf(owner), shop.id, { email: "s1@example.test", role: "staff" });
    await expectCode(addMember(ctxOf(owner), shop.id, { email: "s2@example.test", role: "staff" }), "LIMIT_EXCEEDED");
  });
});
