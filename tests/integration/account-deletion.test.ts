import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { favouriteProducts, shopMembers, shops, users } from "@/db/schema";
import { listUsers, processAccountDeletion } from "@/modules/administration/service";
import { login, requestAccountDeletion } from "@/modules/auth/service";
import { validateSessionToken } from "@/modules/auth/sessions";
import { createEnquiry, getEnquiryThread } from "@/modules/enquiries/service";
import { createActiveShop, createAdmin, createListingFor, createUser, ctxOf, expectCode, north, PASSWORD, countRows, truncateAll } from "./helpers";

beforeEach(truncateAll);

describe("processAccountDeletion", () => {
  it("anonymises PII, revokes sessions and suspends solely-owned shops", async () => {
    const admin = await createAdmin();
    const user = await createUser({ name: "Anil Kumar", email: "anil@example.test" });
    await getDb().update(users).set({ phone: "+91 98470 11111" }).where(eq(users.id, user.id));
    const coOwner = await createUser();
    const other = await createUser();

    const solo = await createActiveShop(user, admin, { name: "Solo Shop" });
    const shared = await createActiveShop(user, admin, { name: "Shared Shop", at: north(1) });
    await getDb().insert(shopMembers).values({ shopId: shared.shop.id, userId: coOwner.id, role: "owner" });
    const otherShop = await createActiveShop(other, admin, { name: "Other Shop", at: north(2) });
    const l = await createListingFor(other, otherShop.shop.id, otherShop.branchId, { name: "Galaxy A55", brand: "Samsung", model: "Galaxy A55" });
    await getDb().insert(favouriteProducts).values({ userId: user.id, catalogProductId: l.catalogProductId });
    const enq = await createEnquiry(ctxOf(user), { shopId: otherShop.shop.id, message: "Please call me back" });

    const { token } = await login(ctxOf(null), { email: "anil@example.test", password: PASSWORD });
    await requestAccountDeletion({ ...ctxOf(user), sessionToken: token });
    expect((await listUsers(ctxOf(admin), { status: "deletion_requested" })).items.map((u) => u.id)).toEqual([user.id]);

    await processAccountDeletion(ctxOf(admin), user.id);

    const row = (await getDb().query.users.findFirst({ where: eq(users.id, user.id) }))!;
    expect(row).toMatchObject({ status: "deleted", name: "Deleted user", phone: null, passwordHash: null });
    expect(row.email).toBe(`deleted+${user.id}@deleted.invalid`);
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(row)).not.toContain("anil@example.test");
    expect(JSON.stringify(row)).not.toContain("Anil");

    expect(await validateSessionToken(token)).toBeNull();
    expect(await countRows("sessions", `user_id = '${user.id}'`)).toBe(0);
    await expectCode(login(ctxOf(null), { email: "anil@example.test", password: PASSWORD }), "VALIDATION_ERROR");

    const shopStatus = async (id: string) => (await getDb().query.shops.findFirst({ where: eq(shops.id, id) }))!.status;
    expect(await shopStatus(solo.shop.id)).toBe("suspended");
    expect(await shopStatus(shared.shop.id)).toBe("active");
    expect(await shopStatus(otherShop.shop.id)).toBe("active");
    expect(await countRows("shop_members", `user_id = '${user.id}'`)).toBe(0);
    expect(await countRows("favourite_products", `user_id = '${user.id}'`)).toBe(0);

    // The shop keeps the enquiry for its records, detached from identity.
    const thread = await getEnquiryThread(ctxOf(other), enq.id);
    expect(thread.messages).toHaveLength(1);
    expect(thread.customerName).not.toContain("Anil");

    // The original email can be registered again.
    const { register } = await import("@/modules/auth/service");
    await register(ctxOf(null), { name: "New Anil", email: "anil@example.test", password: "Fresh-pass-123" });

    await expectCode(processAccountDeletion(ctxOf(admin), user.id), "INVALID_STATE");
  });
});
