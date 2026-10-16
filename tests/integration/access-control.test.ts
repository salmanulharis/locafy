import { beforeAll, describe, expect, it } from "vitest";
import * as admin from "@/modules/administration/service";
import { shopStats } from "@/modules/analytics/service";
import { createEnquiry, getEnquiryThread, listShopEnquiries, replyToEnquiry } from "@/modules/enquiries/service";
import { addBranchInventory, updateInventory } from "@/modules/inventory/service";
import { changeListingStatus, getMerchantListing, listMerchantListings, updateListing } from "@/modules/listings/service";
import { uploadShopImage } from "@/modules/media/service";
import { createOffer, getShopOffer, listShopOffers, offerableListings, setOfferPublished, updateOffer } from "@/modules/offers/service";
import {
  addMember,
  getMerchantShop,
  listMembers,
  removeMember,
  savePrimaryBranch,
  updateShopBasics,
  updateShopContact,
} from "@/modules/shops/service";
import type { SessionUser } from "@/modules/auth/sessions";
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

let superAdmin: SessionUser;
let plainAdmin: SessionUser;
let ownerA: SessionUser;
let ownerB: SessionUser;
let customer: SessionUser;
let shopA: string;
let shopB: string;
let branchA: string;
let listingA: string;
let inventoryA: string;
let offerA: string;
let enquiryA: string;

beforeAll(async () => {
  await truncateAll();
  superAdmin = await createAdmin("super_admin");
  plainAdmin = await createAdmin("admin");
  ownerA = await createUser({ name: "Owner A" });
  ownerB = await createUser({ name: "Owner B" });
  customer = await createUser({ name: "Customer" });
  const a = await createActiveShop(ownerA, superAdmin, { name: "Shop A" });
  const b = await createActiveShop(ownerB, superAdmin, { name: "Shop B", at: north(1) });
  shopA = a.shop.id;
  shopB = b.shop.id;
  branchA = a.branchId;
  const l = await createListingFor(ownerA, shopA, branchA, { name: "Galaxy A55", brand: "Samsung", model: "Galaxy A55" }, { price: "39999", quantity: 5 });
  listingA = l.id;
  inventoryA = (await inventoryRow(listingA)).id;
  const o = await createOffer(
    ctxOf(ownerA),
    shopA,
    { title: "Ten off", discountType: "percent", discountValue: 10, startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString(), listingIds: [listingA] },
    true,
  );
  offerA = o.id;
  enquiryA = (await createEnquiry(ctxOf(customer), { shopId: shopA, message: "Is this available?" })).id;
});

describe("merchant B cannot reach merchant A's resources", () => {
  const B = () => ctxOf(ownerB);
  const cases: [string, () => Promise<unknown>][] = [
    ["getMerchantShop", () => getMerchantShop(B(), shopA)],
    ["updateShopBasics", async () => updateShopBasics(B(), shopA, { name: "Hijacked", categoryId: await categoryId("mobiles") })],
    ["updateShopContact", () => updateShopContact(B(), shopA, { phone: "+91 90000 00000" })],
    ["savePrimaryBranch", () => savePrimaryBranch(B(), shopA, { addressLine: "Evil St", city: "Kochi", lat: 10, lng: 76 })],
    ["listMembers", () => listMembers(B(), shopA)],
    ["addMember", () => addMember(B(), shopA, { email: "x@example.test", role: "staff" })],
    ["listMerchantListings", () => listMerchantListings(B(), shopA, {})],
    ["getMerchantListing", () => getMerchantListing(B(), listingA)],
    ["changeListingStatus", () => changeListingStatus(B(), listingA, "unpublish")],
    ["updateListing", () => updateListing(B(), listingA, { notes: "pwned" })],
    ["updateInventory", () => updateInventory(B(), inventoryA, { price: "1" })],
    ["addBranchInventory", () => addBranchInventory(B(), listingA, { branchId: branchA, price: "1" })],
    ["createOffer", () => createOffer(B(), shopA, { title: "Evil", discountType: "percent", discountValue: 50, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString(), listingIds: [listingA] })],
    ["listShopOffers", () => listShopOffers(B(), shopA)],
    ["getShopOffer", () => getShopOffer(B(), offerA)],
    ["setOfferPublished", () => setOfferPublished(B(), offerA, false)],
    ["updateOffer", () => updateOffer(B(), offerA, { title: "Evil", discountType: "percent", discountValue: 50, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString(), listingIds: [listingA] })],
    ["offerableListings", () => offerableListings(B(), shopA)],
    ["listShopEnquiries", () => listShopEnquiries(B(), shopA)],
    ["getEnquiryThread", () => getEnquiryThread(B(), enquiryA)],
    ["replyToEnquiry", () => replyToEnquiry(B(), enquiryA, { body: "hi" })],
    ["shopStats", () => shopStats(B(), shopA)],
    ["uploadShopImage", () => uploadShopImage(B(), shopA, new Blob([new Uint8Array(100)]), "logo")],
  ];

  it.each(cases)("%s -> NOT_FOUND", async (_name, call) => {
    await expectCode(call(), "NOT_FOUND");
  });

  it("B cannot attach A's listing to its own offer", async () => {
    await expectCode(
      createOffer(ctxOf(ownerB), shopB, { title: "Steal", discountType: "percent", discountValue: 5, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString(), listingIds: [listingA] }),
      "VALIDATION_ERROR",
    );
  });

  it("A's data is unchanged", async () => {
    const shop = await getMerchantShop(ctxOf(ownerA), shopA);
    expect(shop.shop.name).toBe("Shop A");
    expect((await inventoryRow(listingA)).priceMinor).toBe(3_999_900);
    expect((await getShopOffer(ctxOf(ownerA), offerA)).status).toBe("published");
  });
});

describe("platform administration boundaries", () => {
  const adminCalls: [string, (ctx: ReturnType<typeof ctxOf>) => Promise<unknown>][] = [
    ["overview", (c) => admin.overview(c)],
    ["listUsers", (c) => admin.listUsers(c, {})],
    ["getUser", (c) => admin.getUser(c, ownerA.id)],
    ["suspendUser", (c) => admin.suspendUser(c, ownerB.id, { reason: "Because" })],
    ["processAccountDeletion", (c) => admin.processAccountDeletion(c, ownerB.id)],
    ["listShops", (c) => admin.listShops(c, {})],
    ["getShopForAdmin", (c) => admin.getShopForAdmin(c, shopA)],
    ["decideShop", (c) => admin.decideShop(c, shopA, "suspend", { reason: "Because" })],
    ["setShopVerified", (c) => admin.setShopVerified(c, shopA, true)],
    ["setListingRestricted", (c) => admin.setListingRestricted(c, listingA, true, { reason: "Because" })],
    ["assignPlan", async (c) => admin.assignPlan(c, shopA, { planId: await planId("premium") })],
    ["listReports", (c) => admin.listReports(c, {})],
    ["listAuditLogs", (c) => admin.listAuditLogs(c, {})],
    ["forceUnpublishOffer", (c) => admin.forceUnpublishOffer(c, offerA, { reason: "Because" })],
    ["saveSynonym", (c) => admin.saveSynonym(c, { term: "cell", synonyms: "phone" })],
  ];

  it.each(adminCalls)("customer calling %s -> FORBIDDEN", async (_n, call) => {
    await expectCode(call(ctxOf(customer)), "FORBIDDEN");
  });

  it.each(adminCalls)("merchant calling %s -> FORBIDDEN", async (_n, call) => {
    await expectCode(call(ctxOf(ownerA)), "FORBIDDEN");
  });

  it.each(adminCalls)("anonymous calling %s -> UNAUTHENTICATED", async (_n, call) => {
    await expectCode(call(ctxOf(null)), "UNAUTHENTICATED");
  });

  it("nothing was changed by the rejected calls", async () => {
    const shop = await getMerchantShop(ctxOf(ownerA), shopA);
    expect([shop.shop.status, shop.shop.isVerified]).toEqual(["active", false]);
    expect((await getShopOffer(ctxOf(ownerA), offerA)).status).toBe("published");
  });

  it("a suspended admin loses admin access", async () => {
    const a2 = await createAdmin("admin");
    await expectCode(admin.overview(ctxOf({ ...a2, status: "suspended" })), "FORBIDDEN");
  });

  it("admins cannot change their own status", async () => {
    await expectCode(admin.suspendUser(ctxOf(plainAdmin), plainAdmin.id, { reason: "self" }), "INVALID_STATE");
    await expectCode(admin.processAccountDeletion(ctxOf(superAdmin), superAdmin.id), "INVALID_STATE");
    await expectCode(admin.setPlatformRole(ctxOf(superAdmin), superAdmin.id, { role: "user" }), "INVALID_STATE");
  });

  it("only super admins change roles or act on other admins", async () => {
    await expectCode(admin.setPlatformRole(ctxOf(plainAdmin), customer.id, { role: "admin" }), "FORBIDDEN");
    await expectCode(admin.suspendUser(ctxOf(plainAdmin), superAdmin.id, { reason: "coup" }), "FORBIDDEN");
    const other = await createAdmin("admin");
    await expectCode(admin.suspendUser(ctxOf(plainAdmin), other.id, { reason: "coup" }), "FORBIDDEN");

    const target = await createUser();
    await admin.setPlatformRole(ctxOf(superAdmin), target.id, { role: "admin" });
    expect((await admin.getUser(ctxOf(superAdmin), target.id)).user.platformRole).toBe("admin");
    // The user record returned to admins never includes the password hash.
    expect((await admin.getUser(ctxOf(superAdmin), target.id)).user).not.toHaveProperty("passwordHash");
    await admin.suspendUser(ctxOf(superAdmin), other.id, { reason: "Policy" });
    // Plain admins may act on regular users.
    const regular = await createUser();
    await admin.suspendUser(ctxOf(plainAdmin), regular.id, { reason: "Spam" });
  });
});

describe("shop team boundaries", () => {
  it("removed staff member loses access immediately", async () => {
    const staff = await createUser({ email: "temp-staff@example.test" });
    await addMember(ctxOf(ownerA), shopA, { email: "temp-staff@example.test", role: "staff" });
    const staffCtx = ctxOf(staff);
    await updateInventory(staffCtx, inventoryA, { adjust: -1 });
    expect((await getMerchantShop(staffCtx, shopA)).role).toBe("staff");
    await expectCode(shopStats(staffCtx, shopA), "FORBIDDEN");
    await expectCode(addMember(staffCtx, shopA, { email: "other@example.test", role: "staff" }), "FORBIDDEN");

    await removeMember(ctxOf(ownerA), shopA, staff.id);
    // Same context object (as if the session were still open): access is re-checked per call.
    await expectCode(updateInventory(staffCtx, inventoryA, { adjust: -1 }), "NOT_FOUND");
    await expectCode(getMerchantShop(staffCtx, shopA), "NOT_FOUND");
    await expectCode(listShopEnquiries(staffCtx, shopA), "NOT_FOUND");
  });

  it("owners cannot be removed and managers cannot manage members", async () => {
    await expectCode(removeMember(ctxOf(ownerA), shopA, ownerA.id), "INVALID_STATE");
    await admin.assignPlan(ctxOf(superAdmin), shopA, { planId: await planId("starter") });
    const manager = await createUser({ email: "mgr-a@example.test" });
    await addMember(ctxOf(ownerA), shopA, { email: "mgr-a@example.test", role: "manager" });
    await expectCode(addMember(ctxOf(manager), shopA, { email: "x@example.test", role: "staff" }), "FORBIDDEN");
    await expectCode(removeMember(ctxOf(manager), shopA, ownerA.id), "FORBIDDEN");
    // Managers can manage listings.
    await changeListingStatus(ctxOf(manager), listingA, "unpublish");
    await changeListingStatus(ctxOf(manager), listingA, "publish");
    await expectCode(addMember(ctxOf(ownerA), shopA, { email: "mgr-a@example.test", role: "staff" }), "CONFLICT");
  });
});
