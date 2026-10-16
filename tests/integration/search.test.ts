import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { branches, offers } from "@/db/schema";
import {
  assignPlan,
  createSponsoredPlacement,
  deactivateSponsoredPlacement,
  decideShop,
  setCatalogRestricted,
} from "@/modules/administration/service";
import { updateInventory } from "@/modules/inventory/service";
import { changeListingStatus } from "@/modules/listings/service";
import { createOffer } from "@/modules/offers/service";
import { searchProducts, type SearchInput } from "@/modules/search/service";
import type { SessionUser } from "@/modules/auth/sessions";
import {
  createActiveShop,
  createAdmin,
  createListingFor,
  createUser,
  ctxOf,
  expectCode,
  inventoryRow,
  north,
  ORIGIN,
  planId,
  truncateAll,
} from "./helpers";

const A55 = { name: "Samsung Galaxy A55 5G", brand: "Samsung", model: "Galaxy A55", category: "smartphones" };
const MOTO = { name: "Motorola Moto G85", brand: "Motorola", model: "Moto G85", variant: "8/128", category: "smartphones" };

type W = {
  admin: SessionUser;
  ownerA: SessionUser;
  ownerB: SessionUser;
  shopA: string;
  shopB: string;
  a128: string;
  a256: string;
  b128: string;
  buds: string;
  motoA: string;
  motoB: string;
  hidden: Record<"unpublished" | "archived" | "suspended" | "restricted" | "noCoords", string>;
  far: string;
};
let w: W;

const search = (input: SearchInput) => searchProducts(ctxOf(null, "127.0.0.1"), { lat: ORIGIN.lat, lng: ORIGIN.lng, radiusKm: 10, ...input });
const ids = (r: Awaited<ReturnType<typeof search>>) => r.items.map((h) => h.listingId);

beforeAll(async () => {
  await truncateAll();
  const admin = await createAdmin();
  const [ownerA, ownerB, ownerC, ownerD, ownerE] = await Promise.all(["A", "B", "C", "D", "E"].map((n) => createUser({ name: `Owner ${n}` })));
  const A = await createActiveShop(ownerA!, admin, { name: "Shop A" });
  const B = await createActiveShop(ownerB!, admin, { name: "Shop B", at: north(3) });
  const C = await createActiveShop(ownerC!, admin, { name: "Far Shop", at: north(50) });
  const D = await createActiveShop(ownerD!, admin, { name: "Shop D" });
  const E = await createActiveShop(ownerE!, admin, { name: "Shop E", at: north(1) });

  const a128 = await createListingFor(ownerA!, A.shop.id, A.branchId, { ...A55, variant: "8GB / 128GB" }, { price: "39999", quantity: 6 });
  const a256 = await createListingFor(ownerA!, A.shop.id, A.branchId, { ...A55, variant: "8GB / 256GB" }, { price: "42999", quantity: 2 });
  const b128 = await createListingFor(ownerB!, B.shop.id, B.branchId, { ...A55, variant: "8GB / 128GB" }, { price: "38999", quantity: 4 });
  const buds = await createListingFor(ownerA!, A.shop.id, A.branchId, { name: "boAt Airdopes 141", brand: "boAt", model: "Airdopes 141", category: "headphones" }, { price: "1099", stockStatus: "in_stock" });
  const motoA = await createListingFor(ownerA!, A.shop.id, A.branchId, MOTO, { price: "20000", quantity: 5 });
  const motoB = await createListingFor(ownerB!, B.shop.id, B.branchId, MOTO, { price: "21000", quantity: 5 });

  const unpublished = await createListingFor(ownerA!, A.shop.id, A.branchId, { name: "Nokia 105", brand: "Nokia", model: "105" }, { publish: false });
  const archived = await createListingFor(ownerA!, A.shop.id, A.branchId, { name: "Realme Narzo 70", brand: "Realme", model: "Narzo 70" });
  await changeListingStatus(ctxOf(ownerA!), archived.id, "archive");
  const restricted = await createListingFor(ownerA!, A.shop.id, A.branchId, { name: "Zentro Vape Pen", brand: "Zentro", model: "VP1" });
  await setCatalogRestricted(ctxOf(admin), restricted.catalogProductId, true, { reason: "Prohibited item" });
  const suspended = await createListingFor(ownerD!, D.shop.id, D.branchId, { name: "Motorola Edge 50", brand: "Motorola", model: "Edge 50" });
  await decideShop(ctxOf(admin), D.shop.id, "suspend", { reason: "Fraud reports" });
  const noCoords = await createListingFor(ownerE!, E.shop.id, E.branchId, { name: "Google Pixel 8a", brand: "Google", model: "Pixel 8a" });
  await getDb().update(branches).set({ location: null }).where(eq(branches.id, E.branchId));
  const far = await createListingFor(ownerC!, C.shop.id, C.branchId, { name: "OnePlus Nord CE4", brand: "OnePlus", model: "Nord CE4" });

  w = {
    admin,
    ownerA: ownerA!,
    ownerB: ownerB!,
    shopA: A.shop.id,
    shopB: B.shop.id,
    a128: a128.id,
    a256: a256.id,
    b128: b128.id,
    buds: buds.id,
    motoA: motoA.id,
    motoB: motoB.id,
    hidden: { unpublished: unpublished.id, archived: archived.id, suspended: suspended.id, restricted: restricted.id, noCoords: noCoords.id },
    far: far.id,
  };
});

describe("visibility", () => {
  it("published products appear", async () => {
    const r = await search({ q: "samsung" });
    expect(r.matchMode).toBe("exact");
    expect(new Set(ids(r))).toEqual(new Set([w.a128, w.a256, w.b128]));
    expect(r.total).toBe(3);
    expect(r.hasLocation).toBe(true);
  });

  it.each([
    ["unpublished", "nokia"],
    ["archived", "realme narzo"],
    ["suspended", "motorola edge"],
    ["restricted", "zentro vape"],
    ["noCoords", "pixel 8a"],
  ] as const)("%s listings are not shown (query %j)", async (key, q) => {
    const r = await search({ q, radiusKm: 200 });
    expect(ids(r)).not.toContain(w.hidden[key]);
    expect(r.alternatives.map((h) => h.listingId)).not.toContain(w.hidden[key]);
  });

  it("browsing without a query never includes hidden listings", async () => {
    const r = await search({ radiusKm: 200, pageSize: 50 });
    for (const id of Object.values(w.hidden)) expect(ids(r)).not.toContain(id);
    expect(ids(r)).toEqual(expect.arrayContaining([w.a128, w.b128, w.buds, w.far]));
  });

  it("branch without coordinates is excluded even without a location filter", async () => {
    const r = await searchProducts(ctxOf(null), { q: "pixel" });
    expect(ids(r)).not.toContain(w.hidden.noCoords);
  });
});

describe("radius filtering (PostGIS)", () => {
  it("shop 3 km away is included at 5 km and excluded at 2 km", async () => {
    const at5 = await search({ q: "samsung", radiusKm: 5 });
    expect(ids(at5)).toContain(w.b128);
    const hitB = at5.items.find((h) => h.listingId === w.b128)!;
    expect(hitB.distanceM).toBeGreaterThan(2_950);
    expect(hitB.distanceM).toBeLessThan(3_050);
    const hitA = at5.items.find((h) => h.listingId === w.a128)!;
    expect(hitA.distanceM).toBeLessThan(5);

    const at2 = await search({ q: "samsung", radiusKm: 2 });
    expect(ids(at2)).not.toContain(w.b128);
    expect(ids(at2)).toContain(w.a128);
  });

  it("existsOutsideRadius when the product is only stocked far away", async () => {
    const near = await search({ q: "oneplus nord", radiusKm: 5 });
    expect(near.total).toBe(0);
    expect(near.existsOutsideRadius).toBe(true);
    const wide = await search({ q: "oneplus nord", radiusKm: 100 });
    expect(ids(wide)).toEqual([w.far]);
    expect(wide.existsOutsideRadius).toBe(false);
    const nothing = await search({ q: "zzqxv wwkkj", radiusKm: 5 });
    expect(nothing.total).toBe(0);
    expect(nothing.existsOutsideRadius).toBe(false);
  });
});

describe("sorting", () => {
  it("by price (effective, ascending)", async () => {
    const r = await search({ q: "samsung", sort: "price" });
    const prices = r.items.map((h) => h.effectivePriceMinor);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(r.items[0]!.listingId).toBe(w.b128);
  });

  it("by distance (ascending)", async () => {
    const r = await search({ q: "samsung", sort: "distance" });
    const d = r.items.map((h) => h.distanceM!);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(r.items.at(-1)!.listingId).toBe(w.b128);
  });
});

describe("text matching", () => {
  it("typo tolerance: 'samsng' finds Samsung", async () => {
    const r = await search({ q: "samsng" });
    expect(r.matchMode).toBe("fuzzy");
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((h) => h.brand === "Samsung")).toBe(true);
  });

  it("synonym: 'earphones' finds earbuds/headphones", async () => {
    const r = await search({ q: "earphones" });
    expect(ids(r)).toContain(w.buds);
    expect(r.matchMode).toBe("exact");
  });

  it("prefix of the last word: 'galaxy a5' finds the A55", async () => {
    const r = await search({ q: "galaxy a5" });
    expect(ids(r)).toEqual(expect.arrayContaining([w.a128, w.a256]));
  });

  it("variants are separate products, never merged", async () => {
    const r = await search({ q: "galaxy a55" });
    const byProduct = new Map<string, Set<string | null>>();
    for (const h of r.items) (byProduct.get(h.productId) ?? byProduct.set(h.productId, new Set()).get(h.productId)!).add(h.variant);
    expect(byProduct.size).toBe(2);
    for (const variants of byProduct.values()) expect(variants.size).toBe(1);
    const a128 = r.items.find((h) => h.listingId === w.a128)!;
    const b128 = r.items.find((h) => h.listingId === w.b128)!;
    const a256 = r.items.find((h) => h.listingId === w.a256)!;
    expect(a128.productId).toBe(b128.productId);
    expect(a256.productId).not.toBe(a128.productId);
  });

  it("hostile query text does not break the query", async () => {
    for (const q of ["'&|!:()", "samsung' OR 1=1 --", "a:* & !b", "(((", "\\"]) {
      const r = await search({ q });
      expect(Array.isArray(r.items)).toBe(true);
    }
  });
});

describe("live data", () => {
  it("price and stock changes are reflected immediately", async () => {
    let r = await search({ q: "moto g85", sort: "price" });
    expect(ids(r)).toEqual([w.motoA, w.motoB]);

    const invB = await inventoryRow(w.motoB);
    await updateInventory(ctxOf(w.ownerB), invB.id, { price: "15000" });
    r = await search({ q: "moto g85", sort: "price" });
    expect(ids(r)).toEqual([w.motoB, w.motoA]);
    expect(r.items[0]!.priceMinor).toBe(1_500_000);

    await updateInventory(ctxOf(w.ownerB), invB.id, { quantity: 0 });
    r = await search({ q: "moto g85", availability: "in_stock" });
    expect(ids(r)).toEqual([w.motoA]);
    r = await search({ q: "moto g85" });
    expect(r.items.find((h) => h.listingId === w.motoB)?.stockStatus).toBe("out_of_stock");
  });

  it("offer price applies only while the offer is active", async () => {
    const offer = await createOffer(
      ctxOf(w.ownerA),
      w.shopA,
      {
        title: "Festive 10% off",
        discountType: "percent",
        discountValue: 10,
        startsAt: new Date(Date.now() - 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
        listingIds: [w.a128],
      },
      true,
    );
    const hit = async () => (await search({ q: "samsung" })).items.find((h) => h.listingId === w.a128)!;

    let h = await hit();
    expect(h.offerId).toBe(offer.id);
    expect(h.offerPriceMinor).toBe(3_599_910);
    expect(h.effectivePriceMinor).toBe(3_599_910);
    expect(h.priceMinor).toBe(3_999_900);
    const onlyOffers = await search({ q: "samsung", offers: true });
    expect(ids(onlyOffers)).toEqual([w.a128]);

    // Expired.
    await getDb()
      .update(offers)
      .set({ startsAt: sql`now() - interval '2 days'`, endsAt: sql`now() - interval '1 minute'` })
      .where(eq(offers.id, offer.id));
    h = await hit();
    expect(h.offerId).toBeNull();
    expect(h.effectivePriceMinor).toBe(3_999_900);

    // Scheduled (not started yet).
    await getDb()
      .update(offers)
      .set({ startsAt: sql`now() + interval '1 day'`, endsAt: sql`now() + interval '2 days'` })
      .where(eq(offers.id, offer.id));
    expect((await hit()).offerId).toBeNull();

    // Active again but unpublished.
    await getDb()
      .update(offers)
      .set({ startsAt: sql`now() - interval '1 hour'`, endsAt: sql`now() + interval '1 day'`, status: "unpublished" })
      .where(eq(offers.id, offer.id));
    expect((await hit()).offerId).toBeNull();
  });

  it("string flags from query strings are parsed correctly (offers=false does not filter)", async () => {
    // The API passes raw query-string values straight to the service.
    const all = await search({ q: "samsung" });
    for (const v of ["false", "0", ""]) {
      const r = await searchProducts(ctxOf(null), { q: "samsung", lat: String(ORIGIN.lat), lng: String(ORIGIN.lng), radiusKm: "10", offers: v });
      expect(r.total, `offers=${JSON.stringify(v)}`).toBe(all.total);
    }
    const on = await searchProducts(ctxOf(null), { q: "samsung", lat: String(ORIGIN.lat), lng: String(ORIGIN.lng), offers: "true" });
    expect(on.items.every((h) => h.offerId !== null)).toBe(true);
    await expectCode(searchProducts(ctxOf(null), { q: "samsung", offers: "maybe" }), "VALIDATION_ERROR");
  });

  it("sponsored label only for active placements on entitled shops", async () => {
    await expectCode(
      createSponsoredPlacement(ctxOf(w.admin), { listingId: w.b128, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 86_400_000) }),
      "LIMIT_EXCEEDED",
    );
    await assignPlan(ctxOf(w.admin), w.shopA, { planId: await planId("premium") });
    await createSponsoredPlacement(ctxOf(w.admin), {
      listingId: w.a256,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 86_400_000),
    });
    await createSponsoredPlacement(ctxOf(w.admin), {
      listingId: w.a128,
      startsAt: new Date(Date.now() + 86_400_000),
      endsAt: new Date(Date.now() + 2 * 86_400_000),
    });

    let r = await search({ q: "samsung" });
    const flags = Object.fromEntries(r.items.map((h) => [h.listingId, h.sponsored]));
    expect(flags).toEqual({ [w.a256]: true, [w.a128]: false, [w.b128]: false });
    expect(r.sponsored?.listingId).toBe(w.a256);
    // The sponsored slot must satisfy the same query.
    expect((await search({ q: "moto g85" })).sponsored).toBeNull();

    const placements = await getDb().execute<{ id: string }>(sql`select id from sponsored_placements where listing_id = ${w.a256}`);
    await deactivateSponsoredPlacement(ctxOf(w.admin), placements[0]!.id);
    r = await search({ q: "samsung" });
    expect(r.items.some((h) => h.sponsored)).toBe(false);
    expect(r.sponsored).toBeNull();
  });
});
