import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { enquiries, notifications } from "@/db/schema";
import { decideShop } from "@/modules/administration/service";
import { createEnquiry } from "@/modules/enquiries/service";
import { deliverPendingEmails, listNotifications, markAllRead, unreadCount, updatePreferences } from "@/modules/notifications/service";
import { submitVerification } from "@/modules/shops/service";
import { createActiveShop, createAdmin, createCompleteDraftShop, createUser, ctxOf, truncateAll } from "./helpers";

const mailer = vi.hoisted(() => ({ fail: false, sent: [] as string[] }));
vi.mock("@/modules/notifications/mailer", () => ({
  sendMail: vi.fn(async (m: { to: string; subject: string }) => {
    if (mailer.fail) throw new Error("SMTP connection refused");
    mailer.sent.push(`${m.to}|${m.subject}`);
  }),
}));

beforeEach(async () => {
  await truncateAll();
  mailer.fail = false;
  mailer.sent.length = 0;
});

const of = (userId: string) => getDb().select().from(notifications).where(eq(notifications.userId, userId));

describe("notifications", () => {
  it("created for enquiries and shop decisions", async () => {
    const admin = await createAdmin();
    const owner = await createUser({ name: "Owner" });
    const customer = await createUser({ name: "Customer" });
    const { shop } = await createCompleteDraftShop(owner);
    await submitVerification(ctxOf(owner), shop.id, { verificationNote: "GSTIN 32ABCDE1234F1Z5" });
    await decideShop(ctxOf(admin), shop.id, "reject", { reason: "Blurry photos" });
    await submitVerification(ctxOf(owner), shop.id, { verificationNote: "New photos" });
    await decideShop(ctxOf(admin), shop.id, "approve");
    await createEnquiry(ctxOf(customer), { shopId: shop.id, message: "Do you stock chargers?" });

    const types = (await of(owner.id)).map((n) => n.type).sort();
    expect(types).toEqual(["enquiry.new", "shop.approve", "shop.reject"]);
    const reject = (await of(owner.id)).find((n) => n.type === "shop.reject")!;
    expect(reject.body).toBe("Blurry photos");
    expect(reject.emailStatus).toBe("pending");

    const list = await listNotifications(ctxOf(owner));
    expect(list.unreadCount).toBe(3);
    await markAllRead(ctxOf(owner));
    expect(await unreadCount(ctxOf(owner))).toBe(0);
    expect(await unreadCount(ctxOf(null))).toBe(0);
    // Notifications are private to their recipient.
    expect((await listNotifications(ctxOf(customer))).items).toEqual([]);
  });

  it("email delivery: success marks sent; failure marks failed without rolling back the business change", async () => {
    const admin = await createAdmin();
    const owner = await createUser({ name: "Owner" });
    const customer = await createUser({ name: "Customer" });
    const { shop } = await createActiveShop(owner, admin);

    mailer.fail = true;
    const enq = await createEnquiry(ctxOf(customer), { shopId: shop.id, message: "Open on Sunday?" });
    const processed = await deliverPendingEmails();
    expect(processed).toBeGreaterThanOrEqual(1);
    const n = (await of(owner.id)).find((x) => x.type === "enquiry.new")!;
    expect(n.emailStatus).toBe("failed");
    // The enquiry still exists.
    expect(await getDb().query.enquiries.findFirst({ where: eq(enquiries.id, enq.id) })).toBeTruthy();
    // Failed emails are not retried forever by the pending sweep.
    expect(await deliverPendingEmails()).toBe(0);

    mailer.fail = false;
    await createEnquiry(ctxOf(customer), { shopId: shop.id, message: "Also, do you deliver?" });
    await deliverPendingEmails();
    const sent = (await of(owner.id)).filter((x) => x.type === "enquiry.new" && x.emailStatus === "sent");
    expect(sent).toHaveLength(1);
    expect(mailer.sent.some((s) => s.startsWith(`${owner.email}|`))).toBe(true);
  });

  it("email preference off -> in-app only", async () => {
    const admin = await createAdmin();
    const owner = await createUser();
    const customer = await createUser();
    const { shop } = await createActiveShop(owner, admin);
    await updatePreferences(ctxOf(owner), { emailEnquiries: false });
    await createEnquiry(ctxOf(customer), { shopId: shop.id, message: "Quiet notification please" });
    const n = (await of(owner.id)).find((x) => x.type === "enquiry.new")!;
    expect(n.emailStatus).toBe("not_required");
    await deliverPendingEmails();
    // The shop-approval email (separate preference) still goes out; the enquiry one does not.
    const toOwner = mailer.sent.filter((s) => s.startsWith(`${owner.email}|`));
    expect(toOwner.some((s) => s.includes("approved"))).toBe(true);
    expect(toOwner.some((s) => s.includes("enquiry"))).toBe(false);
  });
});
