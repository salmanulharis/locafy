import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { enquiries, enquiryMessages, notifications } from "@/db/schema";
import { changeListingStatus } from "@/modules/listings/service";
import {
  createEnquiry,
  getEnquiryThread,
  listMyEnquiries,
  listShopEnquiries,
  replyToEnquiry,
  setEnquiryClosed,
} from "@/modules/enquiries/service";
import { addMember } from "@/modules/shops/service";
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
  truncateAll,
} from "./helpers";

beforeEach(truncateAll);

async function setup() {
  const admin = await createAdmin();
  const ownerA = await createUser({ name: "Owner A" });
  const ownerB = await createUser({ name: "Owner B" });
  const customer = await createUser({ name: "Priya Raman" });
  const a = await createActiveShop(ownerA, admin, { name: "Shop A" });
  const b = await createActiveShop(ownerB, admin, { name: "Shop B", at: north(2) });
  const l = await createListingFor(ownerA, a.shop.id, a.branchId, { name: "Galaxy A55", brand: "Samsung", model: "Galaxy A55" }, { price: "39999" });
  return { admin, ownerA, ownerB, customer, a, b, listingId: l.id };
}

const status = async (id: string) => (await getDb().query.enquiries.findFirst({ where: eq(enquiries.id, id) }))!.status;

describe("enquiries", () => {
  it("full conversation: open -> responded -> open -> closed -> reopen", async () => {
    const { ownerA, customer, a, listingId } = await setup();
    const enq = await createEnquiry(ctxOf(customer), { shopId: a.shop.id, listingId, quantity: 2, message: "Is the blue one in stock?" });
    expect(enq.status).toBe("open");
    expect(enq.quantity).toBe(2);

    await replyToEnquiry(ctxOf(ownerA), enq.id, { body: "Yes, 3 left." });
    expect(await status(enq.id)).toBe("responded");
    await replyToEnquiry(ctxOf(customer), enq.id, { body: "Great, I'll come at 5." });
    expect(await status(enq.id)).toBe("open");

    await setEnquiryClosed(ctxOf(ownerA), enq.id, true);
    expect(await status(enq.id)).toBe("closed");
    await expectCode(replyToEnquiry(ctxOf(ownerA), enq.id, { body: "One more thing" }), "INVALID_STATE");
    await expectCode(replyToEnquiry(ctxOf(customer), enq.id, { body: "Hello?" }), "INVALID_STATE");
    await expectCode(setEnquiryClosed(ctxOf(customer), enq.id, true), "INVALID_STATE");
    await setEnquiryClosed(ctxOf(customer), enq.id, false);
    expect(await status(enq.id)).toBe("open");

    const thread = await getEnquiryThread(ctxOf(ownerA), enq.id);
    expect(thread.viewerRole).toBe("merchant");
    expect(thread.customerName).toBe("Priya R.");
    expect(thread.messages.map((m) => m.senderRole)).toEqual(["customer", "merchant", "customer"]);
    expect(thread.product?.name).toBe("Galaxy A55");
    expect((await getEnquiryThread(ctxOf(customer), enq.id)).viewerRole).toBe("customer");
    expect((await listMyEnquiries(ctxOf(customer))).map((e) => e.id)).toEqual([enq.id]);
    expect((await listShopEnquiries(ctxOf(ownerA), a.shop.id, { status: "open" })).map((e) => e.id)).toEqual([enq.id]);
  });

  it("is idempotent per clientRequestId (sequential and concurrent)", async () => {
    const { customer, a } = await setup();
    const input = { shopId: a.shop.id, message: "Do you repair phones?", clientRequestId: "req-123" };
    const first = await createEnquiry(ctxOf(customer), input);
    const again = await createEnquiry(ctxOf(customer), input);
    expect(again.id).toBe(first.id);

    const both = await Promise.all([
      createEnquiry(ctxOf(customer), { ...input, clientRequestId: "req-456" }),
      createEnquiry(ctxOf(customer), { ...input, clientRequestId: "req-456" }),
    ]);
    expect(both[0].id).toBe(both[1].id);
    expect(await countRows("enquiries")).toBe(2);
    expect(await countRows("enquiry_messages")).toBe(2);

    // Without a clientRequestId each submission is a new enquiry.
    await createEnquiry(ctxOf(customer), { shopId: a.shop.id, message: "Second question here" });
    await createEnquiry(ctxOf(customer), { shopId: a.shop.id, message: "Second question here" });
    expect(await countRows("enquiries")).toBe(4);
  });

  it("other merchants cannot read or reply (NOT_FOUND); strangers neither", async () => {
    const { ownerB, customer, a, b } = await setup();
    const enq = await createEnquiry(ctxOf(customer), { shopId: a.shop.id, message: "Open on Sunday?" });
    const stranger = await createUser();
    await expectCode(getEnquiryThread(ctxOf(ownerB), enq.id), "NOT_FOUND");
    await expectCode(replyToEnquiry(ctxOf(ownerB), enq.id, { body: "Come to my shop instead" }), "NOT_FOUND");
    await expectCode(setEnquiryClosed(ctxOf(ownerB), enq.id, true), "NOT_FOUND");
    await expectCode(listShopEnquiries(ctxOf(ownerB), a.shop.id), "NOT_FOUND");
    await expectCode(getEnquiryThread(ctxOf(stranger), enq.id), "NOT_FOUND");
    await expectCode(getEnquiryThread(ctxOf(null), enq.id), "UNAUTHENTICATED");
    expect(await listShopEnquiries(ctxOf(ownerB), b.shop.id)).toEqual([]);
    expect(await countRows("enquiry_messages")).toBe(1);
  });

  it("staff can respond to enquiries", async () => {
    const { ownerA, customer, a } = await setup();
    const staff = await createUser({ email: "enq-staff@example.test" });
    await addMember(ctxOf(ownerA), a.shop.id, { email: "enq-staff@example.test", role: "staff" });
    const enq = await createEnquiry(ctxOf(customer), { shopId: a.shop.id, message: "Price for 2 units?" });
    await replyToEnquiry(ctxOf(staff), enq.id, { body: "Same price each." });
    expect(await status(enq.id)).toBe("responded");
  });

  it("cannot enquire to your own shop (owner or staff)", async () => {
    const { ownerA, a } = await setup();
    await expectCode(createEnquiry(ctxOf(ownerA), { shopId: a.shop.id, message: "Testing my own shop" }), "INVALID_STATE");
    const staff = await createUser({ email: "own-staff@example.test" });
    await addMember(ctxOf(ownerA), a.shop.id, { email: "own-staff@example.test", role: "staff" });
    await expectCode(createEnquiry(ctxOf(staff), { shopId: a.shop.id, message: "Testing my own shop" }), "INVALID_STATE");
  });

  it("target shop must be active and listing published", async () => {
    const { ownerA, customer, a, listingId } = await setup();
    const draftOwner = await createUser();
    const draft = await createCompleteDraftShop(draftOwner);
    await expectCode(createEnquiry(ctxOf(customer), { shopId: draft.shop.id, message: "Are you open?" }), "NOT_FOUND");
    await changeListingStatus(ctxOf(ownerA), listingId, "unpublish");
    await expectCode(createEnquiry(ctxOf(customer), { shopId: a.shop.id, listingId, message: "Still available?" }), "NOT_FOUND");
  });

  it("validates content: spam, honeypot, length, quantity", async () => {
    const { customer, a } = await setup();
    const c = ctxOf(customer);
    await expectCode(createEnquiry(c, { shopId: a.shop.id, message: "http://a.co http://b.co http://c.co buy" }), "VALIDATION_ERROR");
    await expectCode(createEnquiry(c, { shopId: a.shop.id, message: "Real question here", website: "http://bot" }), "VALIDATION_ERROR");
    await expectCode(createEnquiry(c, { shopId: a.shop.id, message: "hey" }), "VALIDATION_ERROR");
    await expectCode(createEnquiry(c, { shopId: a.shop.id, message: "Need many", quantity: 0 }), "VALIDATION_ERROR");
    await expectCode(createEnquiry(c, { shopId: a.shop.id, message: "Need many", quantity: 10_001 }), "VALIDATION_ERROR");
    expect(await countRows("enquiries")).toBe(0);
  });

  it("notifies shop members on new enquiries and the customer on replies", async () => {
    const { ownerA, customer, a } = await setup();
    const enq = await createEnquiry(ctxOf(customer), { shopId: a.shop.id, message: "Do you deliver to Aluva?" });
    const toOwner = await getDb().select().from(notifications).where(eq(notifications.userId, ownerA.id));
    const newEnq = toOwner.find((n) => n.type === "enquiry.new")!;
    expect(newEnq.link).toBe(`/merchant/${a.shop.id}/enquiries/${enq.id}`);
    expect(newEnq.emailStatus).toBe("pending");
    await replyToEnquiry(ctxOf(ownerA), enq.id, { body: "Yes, on weekends." });
    const toCustomer = await getDb().select().from(notifications).where(eq(notifications.userId, customer.id));
    expect(toCustomer.map((n) => n.type)).toEqual(["enquiry.reply"]);
    const msgs = await getDb().select().from(enquiryMessages).where(eq(enquiryMessages.enquiryId, enq.id));
    expect(msgs).toHaveLength(2);
  });
});
