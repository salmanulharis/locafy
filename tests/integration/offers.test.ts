import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { offerListings, offers } from "@/db/schema";
import { assignPlan, decideShop } from "@/modules/administration/service";
import { createOffer, listActiveOffers, listShopOffers, setOfferPublished, updateOffer } from "@/modules/offers/service";
import { addMember } from "@/modules/shops/service";
import type { SessionUser } from "@/modules/auth/sessions";
import {
  countRows,
  createActiveShop,
  createAdmin,
  createCompleteDraftShop,
  createListingFor,
  createUser,
  ctxOf,
  expectCode,
  north,
  planId,
  truncateAll,
} from "./helpers";

beforeEach(truncateAll);

const H = 3_600_000;
const D = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function offerInput(listingIds: string[], over: Record<string, unknown> = {}) {
  return {
    title: "Weekend sale",
    discountType: "percent",
    discountValue: 10,
    startsAt: iso(-H),
    endsAt: iso(7 * D),
    listingIds,
    ...over,
  };
}

async function activeShopWithListing(admin: SessionUser, owner: SessionUser, price = "1000") {
  const s = await createActiveShop(owner, admin);
  const l = await createListingFor(owner, s.shop.id, s.branchId, { name: `Phone ${Math.random()}`, brand: "Acme", model: `M${Math.random()}` }, { price });
  return { ...s, listingId: l.id };
}

describe("offers", () => {
  it("publishing requires an active shop; drafts are allowed before approval", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, branchId } = await createCompleteDraftShop(owner);
    const l = await createListingFor(owner, shop.id, branchId, { name: "Draft phone", brand: "Acme", model: "D1" }, { publish: false });
    await expectCode(createOffer(ctxOf(owner), shop.id, offerInput([l.id]), true), "INVALID_STATE");
    const draft = await createOffer(ctxOf(owner), shop.id, offerInput([l.id]), false);
    expect(draft.status).toBe("draft");
    await expectCode(setOfferPublished(ctxOf(owner), draft.id, true), "INVALID_STATE");

    // Suspended shops cannot even create drafts.
    const { submitVerification } = await import("@/modules/shops/service");
    await submitVerification(ctxOf(owner), shop.id, { verificationNote: "GSTIN 32ABCDE1234F1Z5" });
    await decideShop(ctxOf(admin), shop.id, "approve");
    await setOfferPublished(ctxOf(owner), draft.id, true);
    await decideShop(ctxOf(admin), shop.id, "suspend", { reason: "Investigation" });
    await expectCode(createOffer(ctxOf(owner), shop.id, offerInput([l.id])), "INVALID_STATE");
  });

  it("fixed price must be below the current price; amount off must be smaller than the price", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, listingId } = await activeShopWithListing(admin, owner, "1000");
    const ctx = ctxOf(owner);
    const eq1 = await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { discountType: "fixed_price", discountValue: "1000" })), "VALIDATION_ERROR");
    expect(eq1.fieldErrors?.discountValue).toBeDefined();
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { discountType: "fixed_price", discountValue: "1200" })), "VALIDATION_ERROR");
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { discountType: "amount_off", discountValue: "1000" })), "VALIDATION_ERROR");
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { discountType: "fixed_price", discountValue: "abc" })), "VALIDATION_ERROR");
    const ok = await createOffer(ctx, shop.id, offerInput([listingId], { discountType: "fixed_price", discountValue: "999.99" }));
    expect(ok.discountValue).toBe(99_999);
    const ok2 = await createOffer(ctx, shop.id, offerInput([listingId], { discountType: "amount_off", discountValue: "100" }));
    expect(ok2.discountValue).toBe(10_000);
  });

  it("validates percentages and the offer window", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, listingId } = await activeShopWithListing(admin, owner);
    const ctx = ctxOf(owner);
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { discountValue: 96 })), "VALIDATION_ERROR");
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { discountValue: 0 })), "VALIDATION_ERROR");
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { discountValue: 12.5 })), "VALIDATION_ERROR");
    const expired = await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { startsAt: iso(-3 * D), endsAt: iso(-D) })), "VALIDATION_ERROR");
    expect(expired.fieldErrors?.endsAt).toContain("End must be in the future.");
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { endsAt: iso(-2 * H) })), "VALIDATION_ERROR");
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { endsAt: iso(400 * D) })), "VALIDATION_ERROR");
    await expectCode(createOffer(ctx, shop.id, offerInput([listingId], { startsAt: "not a date" })), "VALIDATION_ERROR");
    await expectCode(createOffer(ctx, shop.id, offerInput([])), "VALIDATION_ERROR");
    expect(await countRows("offers")).toBe(0);
  });

  it("listings must belong to the shop (create and update)", async () => {
    const admin = await createAdmin();
    const ownerA = await createUser();
    const ownerB = await createUser();
    const a = await activeShopWithListing(admin, ownerA);
    const b = await activeShopWithListing(admin, ownerB);
    await expectCode(createOffer(ctxOf(ownerA), a.shop.id, offerInput([a.listingId, b.listingId])), "VALIDATION_ERROR");
    const o = await createOffer(ctxOf(ownerA), a.shop.id, offerInput([a.listingId]));
    await expectCode(updateOffer(ctxOf(ownerA), o.id, offerInput([b.listingId])), "VALIDATION_ERROR");
    const links = await getDb().select().from(offerListings).where(eq(offerListings.offerId, o.id));
    expect(links.map((l) => l.listingId)).toEqual([a.listingId]);
  });

  it("enforces maxActiveOffers (free plan: 2)", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, listingId } = await activeShopWithListing(admin, owner);
    const ctx = ctxOf(owner);
    await createOffer(ctx, shop.id, offerInput([listingId]), true);
    await createOffer(ctx, shop.id, offerInput([listingId]), true);
    const e = await expectCode(createOffer(ctx, shop.id, offerInput([listingId]), true), "LIMIT_EXCEEDED");
    expect(e.details).toMatchObject({ limit: "maxActiveOffers", max: 2 });
    const draft = await createOffer(ctx, shop.id, offerInput([listingId]), false);
    await expectCode(setOfferPublished(ctx, draft.id, true), "LIMIT_EXCEEDED");

    // Expired offers stop counting.
    const [first] = await getDb().select().from(offers).where(eq(offers.status, "published")).limit(1);
    await getDb().update(offers).set({ startsAt: new Date(Date.now() - 2 * D), endsAt: new Date(Date.now() - 1000) }).where(eq(offers.id, first!.id));
    await setOfferPublished(ctx, draft.id, true);
    const phases = (await listShopOffers(ctx, shop.id)).map((o) => o.phase).sort();
    expect(phases).toEqual(["active", "active", "expired"]);
    // Re-publishing an expired offer is refused.
    await expectCode(setOfferPublished(ctx, first!.id, true), "INVALID_STATE");
  });

  it("scheduling a future start requires promotionScheduling", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, listingId } = await activeShopWithListing(admin, owner);
    const future = offerInput([listingId], { startsAt: iso(D), endsAt: iso(3 * D) });
    const e = await expectCode(createOffer(ctxOf(owner), shop.id, future, true), "LIMIT_EXCEEDED");
    expect(e.details).toMatchObject({ feature: "promotionScheduling" });
    await assignPlan(ctxOf(admin), shop.id, { planId: await planId("starter") });
    const o = await createOffer(ctxOf(owner), shop.id, future, true);
    expect((await listShopOffers(ctxOf(owner), shop.id)).find((x) => x.id === o.id)?.phase).toBe("scheduled");
    // Scheduled offers are not public yet.
    expect((await listActiveOffers({ shopId: shop.id })).map((x) => x.id)).not.toContain(o.id);
  });

  it("updating an offer cannot bypass the scheduling entitlement or a suspension", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, listingId } = await activeShopWithListing(admin, owner);
    const o = await createOffer(ctxOf(owner), shop.id, offerInput([listingId]), true);
    const e = await expectCode(updateOffer(ctxOf(owner), o.id, offerInput([listingId], { startsAt: iso(D), endsAt: iso(3 * D) })), "LIMIT_EXCEEDED");
    expect(e.details).toMatchObject({ feature: "promotionScheduling" });
    const row = await getDb().query.offers.findFirst({ where: eq(offers.id, o.id) });
    expect(row!.startsAt.getTime()).toBeLessThan(Date.now());
    // A normal edit still works.
    await updateOffer(ctxOf(owner), o.id, offerInput([listingId], { title: "Renamed sale" }));

    await decideShop(ctxOf(admin), shop.id, "suspend", { reason: "Investigation" });
    await expectCode(updateOffer(ctxOf(owner), o.id, offerInput([listingId], { title: "Sneaky edit" })), "INVALID_STATE");
    expect((await getDb().query.offers.findFirst({ where: eq(offers.id, o.id) }))!.title).toBe("Renamed sale");
  });

  it("duplicate listing ids in one offer are tolerated (no internal error)", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, listingId } = await activeShopWithListing(admin, owner);
    const o = await createOffer(ctxOf(owner), shop.id, offerInput([listingId, listingId]));
    expect(await countRows("offer_listings", `offer_id = '${o.id}'`)).toBe(1);
    await updateOffer(ctxOf(owner), o.id, offerInput([listingId, listingId]));
    expect(await countRows("offer_listings", `offer_id = '${o.id}'`)).toBe(1);
  });

  it("public active offers are limited to active shops, published listings and the radius", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const { shop, listingId } = await activeShopWithListing(admin, owner);
    const o = await createOffer(ctxOf(owner), shop.id, offerInput([listingId]), true);
    const at = (km: number) => listActiveOffers({ point: north(km, north(0)), radiusKm: 5 });
    expect((await at(0)).map((x) => x.id)).toEqual([o.id]);
    expect((await listActiveOffers({ point: north(20), radiusKm: 5 })).map((x) => x.id)).toEqual([]);
    await decideShop(ctxOf(admin), shop.id, "suspend", { reason: "Paused" });
    expect(await listActiveOffers({})).toEqual([]);
  });

  it("staff cannot manage offers", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const staff = await createUser({ email: "staff-offers@example.test" });
    const { shop, listingId } = await activeShopWithListing(admin, owner);
    await addMember(ctxOf(owner), shop.id, { email: "staff-offers@example.test", role: "staff" });
    await expectCode(createOffer(ctxOf(staff), shop.id, offerInput([listingId])), "FORBIDDEN");
  });
});
