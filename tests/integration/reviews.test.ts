import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { notifications, reports, reviews } from "@/db/schema";
import { listReports, resolveReport, setReviewStatus } from "@/modules/administration/service";
import { createReport } from "@/modules/reports/service";
import { deleteReview, listShopReviews, respondToReview, upsertReview } from "@/modules/reviews/service";
import { addMember } from "@/modules/shops/service";
import {
  countRows,
  createActiveShop,
  createAdmin,
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
  return { admin, ownerA, ownerB, customer, a, b };
}

const notesOf = (userId: string) => getDb().select().from(notifications).where(eq(notifications.userId, userId));

describe("reviews", () => {
  it("one review per target: a second submission updates it", async () => {
    const { ownerA, customer, a } = await setup();
    const r1 = await upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 4, body: "Helpful staff and fair prices." });
    expect(r1.created).toBe(true);
    const r2 = await upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 2, body: "" });
    expect(r2).toEqual({ id: r1.id, created: false });
    expect(await countRows("reviews")).toBe(1);
    const row = await getDb().query.reviews.findFirst({ where: eq(reviews.id, r1.id) });
    expect([row?.rating, row?.body]).toEqual([2, null]);
    // The owner was notified once (on creation).
    expect((await notesOf(ownerA.id)).filter((n) => n.type === "review.new")).toHaveLength(1);

    const summary = await listShopReviews(ctxOf(null), a.shop.id);
    expect(summary).toMatchObject({ average: 2, count: 1 });
    expect(summary.items[0]!.authorName).toBe("Priya R.");
  });

  it("product reviews are separate from shop reviews", async () => {
    const { ownerA, customer, a } = await setup();
    const l = await createListingFor(ownerA, a.shop.id, a.branchId, { name: "Galaxy A55", brand: "Samsung", model: "Galaxy A55" });
    await upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 5 });
    await upsertReview(ctxOf(customer), { targetType: "product", targetId: l.catalogProductId, rating: 3 });
    expect(await countRows("reviews")).toBe(2);
    await expectCode(upsertReview(ctxOf(customer), { targetType: "product", targetId: a.shop.id, rating: 3 }), "NOT_FOUND");
  });

  it("cannot review your own shop (owner or staff)", async () => {
    const { ownerA, a } = await setup();
    await expectCode(upsertReview(ctxOf(ownerA), { targetType: "shop", targetId: a.shop.id, rating: 5 }), "FORBIDDEN");
    const staff = await createUser({ email: "rev-staff@example.test" });
    await addMember(ctxOf(ownerA), a.shop.id, { email: "rev-staff@example.test", role: "staff" });
    await expectCode(upsertReview(ctxOf(staff), { targetType: "shop", targetId: a.shop.id, rating: 5 }), "FORBIDDEN");
    expect(await countRows("reviews")).toBe(0);
  });

  it("validates rating and body", async () => {
    const { customer, a } = await setup();
    await expectCode(upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 0 }), "VALIDATION_ERROR");
    await expectCode(upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 6 }), "VALIDATION_ERROR");
    await expectCode(upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 4, body: "short" }), "VALIDATION_ERROR");
  });

  it("edit window: older reviews cannot be edited, only deleted", async () => {
    const { customer, a } = await setup();
    const r = await upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 4 });
    await getDb().update(reviews).set({ createdAt: sql`now() - interval '31 days'` }).where(eq(reviews.id, r.id));
    await expectCode(upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 1 }), "INVALID_STATE");
    const other = await createUser();
    await expectCode(deleteReview(ctxOf(other), r.id), "NOT_FOUND");
    await deleteReview(ctxOf(customer), r.id);
    await upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 1 });
  });

  it("merchant response: owner/manager only, own shop only", async () => {
    const { ownerA, ownerB, customer, a } = await setup();
    const r = await upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 3, body: "Okay experience overall." });
    await expectCode(respondToReview(ctxOf(ownerB), r.id, { response: "Not my shop" }), "NOT_FOUND");
    const staff = await createUser({ email: "resp-staff@example.test" });
    await addMember(ctxOf(ownerA), a.shop.id, { email: "resp-staff@example.test", role: "staff" });
    await expectCode(respondToReview(ctxOf(staff), r.id, { response: "Thanks!" }), "FORBIDDEN");
    await respondToReview(ctxOf(ownerA), r.id, { response: "Thanks, we will improve." });
    const row = await getDb().query.reviews.findFirst({ where: eq(reviews.id, r.id) });
    expect(row?.merchantResponse).toBe("Thanks, we will improve.");
    expect(row?.merchantRespondedAt).toBeInstanceOf(Date);
  });
});

describe("moderation", () => {
  it("admin hide removes a review from the public list and notifies the author", async () => {
    const { admin, ownerA, customer, a } = await setup();
    const other = await createUser({ name: "Joseph Mathew" });
    const r1 = await upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 1, body: "Terrible, avoid this place!" });
    await upsertReview(ctxOf(other), { targetType: "shop", targetId: a.shop.id, rating: 5 });

    await expectCode(setReviewStatus(ctxOf(admin), r1.id, "hidden", {}), "VALIDATION_ERROR");
    await setReviewStatus(ctxOf(admin), r1.id, "hidden", { reason: "Abusive language" });
    const pub = await listShopReviews(ctxOf(null), a.shop.id, { includeHidden: true });
    expect(pub.items.map((i) => i.id)).not.toContain(r1.id);
    expect(pub).toMatchObject({ average: 5, count: 1 });
    // Shop owner and admins can still see hidden reviews when asked.
    expect((await listShopReviews(ctxOf(ownerA), a.shop.id, { includeHidden: true })).items).toHaveLength(2);
    expect((await listShopReviews(ctxOf(admin), a.shop.id, { includeHidden: true })).items).toHaveLength(2);
    expect((await notesOf(customer.id)).map((n) => n.type)).toContain("review.moderated");

    await setReviewStatus(ctxOf(admin), r1.id, "removed", { reason: "Repeated abuse" });
    await expectCode(upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 2 }), "FORBIDDEN");
    await expectCode(setReviewStatus(ctxOf(customer), r1.id, "published"), "FORBIDDEN");
  });

  it("reports are de-duplicated and resolving notifies every reporter", async () => {
    const { admin, customer, a } = await setup();
    const reporter2 = await createUser();
    const r = await upsertReview(ctxOf(customer), { targetType: "shop", targetId: a.shop.id, rating: 1 });
    const rep1 = await createReport(ctxOf(reporter2), { targetType: "review", targetId: r.id, reason: "offensive" });
    const dup = await createReport(ctxOf(reporter2), { targetType: "review", targetId: r.id, reason: "spam", details: "Copy-paste" });
    expect(dup).toEqual({ id: rep1.id, duplicate: true });
    const reporter3 = await createUser();
    await createReport(ctxOf(reporter3), { targetType: "review", targetId: r.id, reason: "spam" });
    expect(await countRows("reports")).toBe(2);
    expect((await listReports(ctxOf(admin), {})).length).toBe(2);
    await expectCode(listReports(ctxOf(customer), {}), "FORBIDDEN");

    await expectCode(resolveReport(ctxOf(admin), rep1.id, { outcome: "actioned", note: "" }), "VALIDATION_ERROR");
    await resolveReport(ctxOf(admin), rep1.id, { outcome: "actioned", note: "Review hidden" });
    const rows = await getDb().select().from(reports).where(and(eq(reports.targetType, "review"), eq(reports.targetId, r.id)));
    expect(rows.every((x) => x.status === "actioned" && x.resolvedBy === admin.id)).toBe(true);
    for (const u of [reporter2, reporter3]) {
      expect((await notesOf(u.id)).map((n) => n.type)).toEqual(["report.resolved"]);
    }
    await expectCode(resolveReport(ctxOf(admin), rep1.id, { outcome: "dismissed", note: "Again" }), "INVALID_STATE");
    // A new report after resolution opens a fresh one.
    const again = await createReport(ctxOf(reporter2), { targetType: "review", targetId: r.id, reason: "spam" });
    expect(again.duplicate).toBe(false);
  });
});
