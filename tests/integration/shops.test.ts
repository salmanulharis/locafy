import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { branches, notifications, shops } from "@/db/schema";
import { decideShop } from "@/modules/administration/service";
import { addBranchInventory, updateInventory } from "@/modules/inventory/service";
import { changeListingStatus, createListing, updateListing } from "@/modules/listings/service";
import {
  addBranch,
  addMember,
  createShop,
  getPublicShopBySlug,
  onboardingGaps,
  savePrimaryBranch,
  submitVerification,
  updateShopBasics,
  updateShopContact,
} from "@/modules/shops/service";
import {
  categoryId,
  createActiveShop,
  createAdmin,
  createCompleteDraftShop,
  createListingFor,
  createUser,
  ctxOf,
  expectCode,
  inventoryRow,
  ORIGIN,
  truncateAll,
} from "./helpers";

beforeEach(truncateAll);

const shopRow = async (id: string) => (await getDb().query.shops.findFirst({ where: eq(shops.id, id) }))!;

describe("shop lifecycle", () => {
  it("create -> incomplete submission rejected -> complete -> pending -> approve -> active", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const ctx = ctxOf(owner);
    const shop = await createShop(ctx, { name: "Anil Mobiles", categoryId: await categoryId("mobiles") });
    expect(shop.status).toBe("draft");

    const gaps = await expectCode(submitVerification(ctx, shop.id, { verificationNote: "GSTIN 32ABCDE1234F1Z5" }), "VALIDATION_ERROR");
    expect(gaps.fieldErrors?._form).toEqual(["address and map location", "contact phone"]);
    expect((await shopRow(shop.id)).status).toBe("draft");

    await savePrimaryBranch(ctx, shop.id, { addressLine: "NH 66", city: "Kochi", lat: ORIGIN.lat, lng: ORIGIN.lng });
    expect(await onboardingGaps(shop.id)).toEqual(["contact phone"]);
    await updateShopContact(ctx, shop.id, { phone: "+91 98470 00001" });
    expect(await onboardingGaps(shop.id)).toEqual([]);

    // Verification note is required.
    await expectCode(submitVerification(ctx, shop.id, { verificationNote: "" }), "VALIDATION_ERROR");
    await submitVerification(ctx, shop.id, { verificationNote: "GSTIN 32ABCDE1234F1Z5" });
    expect((await shopRow(shop.id)).status).toBe("pending");
    // Admins are told about the pending shop.
    const adminNotes = await getDb().select().from(notifications).where(eq(notifications.userId, admin.id));
    expect(adminNotes.map((n) => n.type)).toContain("shop.pending");
    // Cannot submit twice.
    await expectCode(submitVerification(ctx, shop.id, { verificationNote: "again please" }), "INVALID_STATE");
    // Not public while pending.
    expect(await getPublicShopBySlug(ctxOf(null), shop.slug)).toBeNull();
    expect(await getPublicShopBySlug(ctx, shop.slug)).not.toBeNull();

    await decideShop(ctxOf(admin), shop.id, "approve");
    const approved = await shopRow(shop.id);
    expect(approved.status).toBe("active");
    expect(approved.approvedAt).toBeInstanceOf(Date);
    expect((await getPublicShopBySlug(ctxOf(null), shop.slug))?.branches).toHaveLength(1);
    await expectCode(decideShop(ctxOf(admin), shop.id, "approve"), "INVALID_STATE");
  });

  it("rejection needs a reason; the owner can fix and resubmit", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop } = await createCompleteDraftShop(owner);
    await submitVerification(ctxOf(owner), shop.id, { verificationNote: "GSTIN 32ABCDE1234F1Z5" });

    await expectCode(decideShop(ctxOf(admin), shop.id, "reject", {}), "VALIDATION_ERROR");
    await decideShop(ctxOf(admin), shop.id, "reject", { reason: "Photo of storefront missing" });
    const rejected = await shopRow(shop.id);
    expect(rejected.status).toBe("rejected");
    expect(rejected.statusReason).toBe("Photo of storefront missing");

    // Rejected shops remain editable and can be resubmitted.
    await updateShopBasics(ctxOf(owner), shop.id, { name: "Fixed Name", categoryId: await categoryId("mobiles") });
    await submitVerification(ctxOf(owner), shop.id, { verificationNote: "Added storefront photo" });
    const resubmitted = await shopRow(shop.id);
    expect(resubmitted.status).toBe("pending");
    expect(resubmitted.statusReason).toBeNull();
    await decideShop(ctxOf(admin), shop.id, "approve");
    expect((await shopRow(shop.id)).status).toBe("active");
  });

  it("only the owner can submit for verification", async () => {
    const owner = await createUser();
    const manager = await createUser({ email: "mgr@example.test" });
    const { shop } = await createCompleteDraftShop(owner);
    await addMember(ctxOf(owner), shop.id, { email: "mgr@example.test", role: "manager" });
    await expectCode(submitVerification(ctxOf(manager), shop.id, { verificationNote: "GSTIN 32ABCDE1234F1Z5" }), "FORBIDDEN");
  });

  it("suspension blocks profile, listing and inventory edits", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, branchId } = await createActiveShop(owner, admin);
    const l = await createListingFor(owner, shop.id, branchId, { name: "Redmi Note 13", brand: "Xiaomi", model: "Redmi Note 13", variant: "6/128" }, { price: "16999", quantity: 5 });
    const inv = await inventoryRow(l.id);

    await expectCode(decideShop(ctxOf(admin), shop.id, "suspend", {}), "VALIDATION_ERROR");
    await decideShop(ctxOf(admin), shop.id, "suspend", { reason: "Counterfeit goods reported" });
    expect((await shopRow(shop.id)).status).toBe("suspended");

    const ctx = ctxOf(owner);
    await expectCode(
      createListingFor(owner, shop.id, branchId, { name: "Another phone", brand: "X", model: "Y" }, { publish: false }),
      "INVALID_STATE",
    );
    await expectCode(changeListingStatus(ctx, l.id, "unpublish"), "INVALID_STATE");
    await expectCode(updateListing(ctx, l.id, { notes: "x" }), "INVALID_STATE");
    await expectCode(updateInventory(ctx, inv.id, { price: "100" }), "INVALID_STATE");
    await expectCode(updateShopBasics(ctx, shop.id, { name: "New name", categoryId: await categoryId("mobiles") }), "INVALID_STATE");
    await expectCode(updateShopContact(ctx, shop.id, { phone: "+91 98470 00009" }), "INVALID_STATE");
    await expectCode(addBranchInventory(ctx, l.id, { branchId, price: "100" }), "INVALID_STATE");
    expect((await inventoryRow(l.id)).priceMinor).toBe(1_699_900);
    expect(await getPublicShopBySlug(ctxOf(null), shop.slug)).toBeNull();

    await decideShop(ctxOf(admin), shop.id, "reactivate");
    await updateInventory(ctx, inv.id, { price: "15999" });
    expect((await inventoryRow(l.id)).priceMinor).toBe(1_599_900);
  });

  it("branch coordinates are validated and 0,0 is refused", async () => {
    const owner = await createUser();
    const shop = await createShop(ctxOf(owner), { name: "Geo Shop", categoryId: await categoryId("mobiles") });
    const e = await expectCode(savePrimaryBranch(ctxOf(owner), shop.id, { addressLine: "1 Road", city: "Kochi", lat: 0, lng: 0 }), "VALIDATION_ERROR");
    expect(e.fieldErrors?.lat).toBeDefined();
    await expectCode(savePrimaryBranch(ctxOf(owner), shop.id, { addressLine: "1 Road", city: "Kochi", lat: 91, lng: 76 }), "VALIDATION_ERROR");
    // Updating the primary branch keeps a single primary.
    await savePrimaryBranch(ctxOf(owner), shop.id, { addressLine: "1 Road", city: "Kochi", lat: 10, lng: 76 });
    await savePrimaryBranch(ctxOf(owner), shop.id, { addressLine: "2 Road", city: "Kochi", lat: 10.1, lng: 76 });
    const rows = await getDb().select().from(branches).where(eq(branches.shopId, shop.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.addressLine).toBe("2 Road");
  });

  it("an owner can own at most 3 shops", async () => {
    const owner = await createUser();
    const cat = await categoryId("mobiles");
    for (let i = 0; i < 3; i++) await createShop(ctxOf(owner), { name: `Shop ${i}`, categoryId: cat });
    await expectCode(createShop(ctxOf(owner), { name: "Shop 4", categoryId: cat }), "LIMIT_EXCEEDED");
  });

  it("free plan allows one branch", async () => {
    const owner = await createUser();
    const { shop } = await createCompleteDraftShop(owner);
    await expectCode(addBranch(ctxOf(owner), shop.id, { addressLine: "2 Side St", city: "Kochi", lat: 10.03, lng: 76.31 }), "LIMIT_EXCEEDED");
  });

  it("listing creation with publish on a draft shop rolls back completely", async () => {
    const owner = await createUser();
    const { shop, branchId } = await createCompleteDraftShop(owner);
    const e = await expectCode(
      createListing(ctxOf(owner), shop.id, {
        product: { name: "Galaxy M15", brand: "Samsung", model: "Galaxy M15", categoryId: await categoryId("smartphones") },
        stock: [{ branchId, price: "12999" }],
        publish: true,
      }),
      "INVALID_STATE",
    );
    expect(e.message).toMatch(/approved/);
    const n = await getDb().execute<{ n: number }>(`select (select count(*) from listings)::int + (select count(*) from catalog_products)::int as n` as never);
    expect(Number(n[0]!.n)).toBe(0);
  });
});
