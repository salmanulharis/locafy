import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { branches, catalogProducts, listings } from "@/db/schema";
import { setCatalogRestricted, setListingRestricted } from "@/modules/administration/service";
import { changeListingStatus, createListing, getMerchantListing, updateListing } from "@/modules/listings/service";
import {
  categoryId,
  countRows,
  createActiveShop,
  createAdmin,
  createCompleteDraftShop,
  createListingFor,
  createUser,
  ctxOf,
  expectCode,
  inventoryRow,
  north,
  truncateAll,
} from "./helpers";

beforeEach(truncateAll);

const A55 = { name: "Samsung Galaxy A55 5G", brand: "Samsung", model: "Galaxy A55", variant: "8GB / 128GB" };
const listingStatus = async (id: string) => (await getDb().query.listings.findFirst({ where: eq(listings.id, id) }))!.status;

async function twoShops() {
  const admin = await createAdmin();
  const ownerA = await createUser({ name: "Owner A" });
  const ownerB = await createUser({ name: "Owner B" });
  const a = await createActiveShop(ownerA, admin, { name: "Shop A" });
  const b = await createActiveShop(ownerB, admin, { name: "Shop B", at: north(3) });
  return { admin, ownerA, ownerB, a, b };
}

describe("publication rules", () => {
  it("requires an active shop; drafts created before approval can be published after", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, branchId } = await createCompleteDraftShop(owner);
    const draft = await createListingFor(owner, shop.id, branchId, A55, { publish: false, price: "39999" });
    expect(await listingStatus(draft.id)).toBe("draft");
    await expectCode(changeListingStatus(ctxOf(owner), draft.id, "publish"), "INVALID_STATE");

    const { submitVerification } = await import("@/modules/shops/service");
    const { decideShop } = await import("@/modules/administration/service");
    await submitVerification(ctxOf(owner), shop.id, { verificationNote: "GSTIN 32ABCDE1234F1Z5" });
    await expectCode(changeListingStatus(ctxOf(owner), draft.id, "publish"), "INVALID_STATE"); // pending
    await decideShop(ctxOf(admin), shop.id, "approve");
    await changeListingStatus(ctxOf(owner), draft.id, "publish");
    expect(await listingStatus(draft.id)).toBe("published");
  });

  it("requires a priced branch with a map location", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, branchId } = await createActiveShop(owner, admin);
    await getDb().update(branches).set({ location: null }).where(eq(branches.id, branchId));
    const e = await expectCode(createListingFor(owner, shop.id, branchId, A55, { publish: true }), "INVALID_STATE");
    expect(e.message).toMatch(/map location/);
    const d = await createListingFor(owner, shop.id, branchId, A55, { publish: false });
    await expectCode(changeListingStatus(ctxOf(owner), d.id, "publish"), "INVALID_STATE");
  });

  it("validates prices on creation", async () => {
    const { ownerA, a } = await twoShops();
    const cat = await categoryId("smartphones");
    const base = { product: { ...A55, categoryId: cat }, publish: false };
    await expectCode(createListing(ctxOf(ownerA), a.shop.id, { ...base, stock: [{ branchId: a.branchId, price: "0" }] }), "VALIDATION_ERROR");
    await expectCode(createListing(ctxOf(ownerA), a.shop.id, { ...base, stock: [{ branchId: a.branchId, price: "12.345" }] }), "VALIDATION_ERROR");
    const mrp = await expectCode(
      createListing(ctxOf(ownerA), a.shop.id, { ...base, stock: [{ branchId: a.branchId, price: "500", mrp: "400" }] }),
      "VALIDATION_ERROR",
    );
    expect(mrp.fieldErrors?.["stock.0.mrp"]).toBeDefined();
    await expectCode(createListing(ctxOf(ownerA), a.shop.id, { ...base, stock: [{ branchId: a.branchId, price: "5", quantity: -1 }] }), "VALIDATION_ERROR");
    await expectCode(createListing(ctxOf(ownerA), a.shop.id, { ...base, stock: [] }), "VALIDATION_ERROR");
    expect(await countRows("listings")).toBe(0);
  });

  it("rejects the same branch twice in one listing with a validation error", async () => {
    const { ownerA, a } = await twoShops();
    await expectCode(
      createListing(ctxOf(ownerA), a.shop.id, {
        product: { ...A55, categoryId: await categoryId("smartphones") },
        stock: [
          { branchId: a.branchId, price: "100" },
          { branchId: a.branchId, price: "200" },
        ],
      }),
      "VALIDATION_ERROR",
    );
    expect(await countRows("listings")).toBe(0);
  });

  it("rejects stock for a branch of another shop", async () => {
    const { ownerA, a, b } = await twoShops();
    const e = await expectCode(createListingFor(ownerA, a.shop.id, b.branchId, A55), "VALIDATION_ERROR");
    expect(e.message).toMatch(/branches is not part of this shop/);
  });

  it("listing lifecycle transitions are enforced by the service", async () => {
    const { ownerA, a } = await twoShops();
    const l = await createListingFor(ownerA, a.shop.id, a.branchId, A55);
    const ctx = ctxOf(ownerA);
    await changeListingStatus(ctx, l.id, "unpublish");
    await changeListingStatus(ctx, l.id, "archive");
    await expectCode(changeListingStatus(ctx, l.id, "publish"), "INVALID_STATE");
    await changeListingStatus(ctx, l.id, "restore");
    expect(await listingStatus(l.id)).toBe("draft");
    await changeListingStatus(ctx, l.id, "publish");
    await changeListingStatus(ctx, l.id, "discontinue");
    await expectCode(changeListingStatus(ctx, l.id, "unpublish"), "INVALID_STATE");
  });

  it("moderator-restricted listings cannot be republished by the merchant", async () => {
    const { admin, ownerA, a } = await twoShops();
    const l = await createListingFor(ownerA, a.shop.id, a.branchId, A55);
    await setListingRestricted(ctxOf(admin), l.id, true, { reason: "Misleading title" });
    expect(await listingStatus(l.id)).toBe("restricted");
    await expectCode(changeListingStatus(ctxOf(ownerA), l.id, "publish"), "INVALID_STATE");
    await expectCode(changeListingStatus(ctxOf(ownerA), l.id, "restore"), "INVALID_STATE");
    await setListingRestricted(ctxOf(admin), l.id, false);
    await changeListingStatus(ctxOf(ownerA), l.id, "publish");
  });
});

describe("shared catalogue", () => {
  it("same product from two shops shares one catalogue entry", async () => {
    const { ownerA, ownerB, a, b } = await twoShops();
    const la = await createListingFor(ownerA, a.shop.id, a.branchId, A55, { price: "39999" });
    // Different casing / punctuation still resolves to the same identity.
    const lb = await createListingFor(ownerB, b.shop.id, b.branchId, { ...A55, brand: "SAMSUNG", model: "galaxy-a55", variant: "8gb/128gb" }, { price: "38999" });
    expect(lb.catalogProductId).toBe(la.catalogProductId);
    expect(await countRows("catalog_products")).toBe(1);
    expect(await countRows("brands")).toBe(1);
  });

  it("a different variant creates a different catalogue entry", async () => {
    const { ownerA, a } = await twoShops();
    const l128 = await createListingFor(ownerA, a.shop.id, a.branchId, A55);
    const l256 = await createListingFor(ownerA, a.shop.id, a.branchId, { ...A55, variant: "8GB / 256GB" });
    expect(l256.catalogProductId).not.toBe(l128.catalogProductId);
    expect(await countRows("catalog_products")).toBe(2);
  });

  it("duplicate listing in the same shop -> CONFLICT", async () => {
    const { ownerA, a } = await twoShops();
    const first = await createListingFor(ownerA, a.shop.id, a.branchId, A55);
    const e = await expectCode(createListingFor(ownerA, a.shop.id, a.branchId, A55), "CONFLICT");
    expect(e.message).toMatch(/already lists/);
    await expectCode(
      createListing(ctxOf(ownerA), a.shop.id, { catalogProductId: first.catalogProductId, stock: [{ branchId: a.branchId, price: "1" }] }),
      "CONFLICT",
    );
    expect(await countRows("listings")).toBe(1);
  });

  it("restricted products cannot be listed (by identity or by id) or republished", async () => {
    const { admin, ownerA, ownerB, a, b } = await twoShops();
    const la = await createListingFor(ownerA, a.shop.id, a.branchId, A55);
    await expectCode(setCatalogRestricted(ctxOf(admin), la.catalogProductId, true, {}), "VALIDATION_ERROR");
    await setCatalogRestricted(ctxOf(admin), la.catalogProductId, true, { reason: "Recalled model" });

    await expectCode(createListingFor(ownerB, b.shop.id, b.branchId, A55), "FORBIDDEN");
    await expectCode(
      createListing(ctxOf(ownerB), b.shop.id, { catalogProductId: la.catalogProductId, stock: [{ branchId: b.branchId, price: "100" }] }),
      "FORBIDDEN",
    );
    await changeListingStatus(ctxOf(ownerA), la.id, "unpublish");
    const e = await expectCode(changeListingStatus(ctxOf(ownerA), la.id, "publish"), "INVALID_STATE");
    expect(e.message).toMatch(/restricted/);
  });

  it("merchants may edit catalogue details only when they are the sole lister and creator", async () => {
    const { ownerA, ownerB, a, b } = await twoShops();
    const la = await createListingFor(ownerA, a.shop.id, a.branchId, A55);
    const cat = await categoryId("smartphones");
    await updateListing(ctxOf(ownerA), la.id, { notes: "Box sealed", product: { ...A55, categoryId: cat, description: "Updated" } });
    const p = await getDb().query.catalogProducts.findFirst({ where: eq(catalogProducts.id, la.catalogProductId) });
    expect(p?.description).toBe("Updated");
    expect((await getMerchantListing(ctxOf(ownerA), la.id)).editableCatalog).toBe(true);

    await createListingFor(ownerB, b.shop.id, b.branchId, A55);
    await expectCode(updateListing(ctxOf(ownerA), la.id, { product: { ...A55, categoryId: cat, description: "Again" } }), "FORBIDDEN");
  });

  it("each shop keeps its own price for the shared product", async () => {
    const { ownerA, ownerB, a, b } = await twoShops();
    const la = await createListingFor(ownerA, a.shop.id, a.branchId, A55, { price: "39999" });
    const lb = await createListingFor(ownerB, b.shop.id, b.branchId, A55, { price: "38999.50" });
    expect((await inventoryRow(la.id)).priceMinor).toBe(3_999_900);
    expect((await inventoryRow(lb.id)).priceMinor).toBe(3_899_950);
  });
});
