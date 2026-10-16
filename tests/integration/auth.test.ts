import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { suspendUser } from "@/modules/administration/service";
import { changePassword, login, register, requestPasswordReset, resetPassword } from "@/modules/auth/service";
import { validateSessionToken } from "@/modules/auth/sessions";
import { countRows, createAdmin, createUser, ctxOf, expectCode, PASSWORD, truncateAll } from "./helpers";

const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/modules/notifications/mailer", () => ({
  sendMail: vi.fn(async (m: { to: string; subject: string; text: string }) => {
    mail.sent.push(m);
  }),
}));

const anon = () => ctxOf(null, "10.0.0.1");

beforeEach(async () => {
  await truncateAll();
  mail.sent.length = 0;
});

describe("register", () => {
  it("creates a user and a valid session", async () => {
    const r = await register(anon(), { name: "Priya Menon", email: "Priya@Example.test", password: "Secret-pass-1" });
    expect(r.user.email).toBe("priya@example.test");
    const s = await validateSessionToken(r.token);
    expect(s?.user.id).toBe(r.user.id);
    const row = await getDb().query.users.findFirst({ where: eq(users.id, r.user.id) });
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.passwordHash).not.toContain("Secret-pass-1");
  });

  it("rejects a duplicate email (case-insensitive) with a field error", async () => {
    await register(anon(), { name: "Priya", email: "dup@example.test", password: "Secret-pass-1" });
    const e = await expectCode(register(anon(), { name: "Other", email: "DUP@example.test", password: "Secret-pass-2" }), "VALIDATION_ERROR");
    expect(e.fieldErrors?.email?.[0]).toMatch(/already exists/);
    expect(await countRows("users")).toBe(1);
  });

  it("validates password strength", async () => {
    const e = await expectCode(register(anon(), { name: "Weak", email: "w@example.test", password: "short" }), "VALIDATION_ERROR");
    expect(e.fieldErrors?.password).toBeDefined();
    await expectCode(register(anon(), { name: "Weak", email: "w@example.test", password: "onlyletterslong" }), "VALIDATION_ERROR");
  });
});

describe("login", () => {
  it("succeeds with the right password and fails otherwise", async () => {
    const u = await createUser({ email: "m@example.test" });
    const ok = await login(anon(), { email: "M@example.test", password: PASSWORD });
    expect(ok.user.id).toBe(u.id);
    expect((await validateSessionToken(ok.token))?.user.id).toBe(u.id);

    const bad = await expectCode(login(anon(), { email: "m@example.test", password: "wrong-pass-1" }), "VALIDATION_ERROR");
    expect(bad.message).toBe("Email or password is incorrect.");
    const unknown = await expectCode(login(anon(), { email: "nobody@example.test", password: PASSWORD }), "VALIDATION_ERROR");
    // Same message for unknown accounts (no enumeration).
    expect(unknown.message).toBe(bad.message);
  });

  it("suspended users cannot log in and their existing sessions stop validating", async () => {
    const u = await createUser({ email: "s@example.test" });
    const { token } = await login(anon(), { email: "s@example.test", password: PASSWORD });
    expect(await validateSessionToken(token)).not.toBeNull();

    // Status alone is enough to invalidate a session (even before revocation).
    await getDb().update(users).set({ status: "suspended" }).where(eq(users.id, u.id));
    expect(await validateSessionToken(token)).toBeNull();
    await expectCode(login(anon(), { email: "s@example.test", password: PASSWORD }), "FORBIDDEN");
  });

  it("admin suspension revokes sessions and blocks login", async () => {
    const admin = await createAdmin();
    const u = await createUser({ email: "s2@example.test" });
    const { token } = await login(anon(), { email: "s2@example.test", password: PASSWORD });
    await suspendUser(ctxOf(admin), u.id, { reason: "Spam reports" });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await countRows("sessions", `user_id = '${u.id}'`)).toBe(0);
    await expectCode(login(anon(), { email: "s2@example.test", password: PASSWORD }), "FORBIDDEN");
  });

  it("deleted accounts cannot log in", async () => {
    await createUser({ email: "d@example.test", status: "deleted" });
    await expectCode(login(anon(), { email: "d@example.test", password: PASSWORD }), "VALIDATION_ERROR");
  });
});

describe("password reset", () => {
  it("token is single-use and revokes existing sessions", async () => {
    await createUser({ email: "r@example.test" });
    const { token: session } = await login(anon(), { email: "r@example.test", password: PASSWORD });

    await requestPasswordReset(anon(), { email: "r@example.test" });
    expect(mail.sent).toHaveLength(1);
    const link = mail.sent[0]!.text.match(/token=([^\s]+)/)![1]!;
    const resetToken = decodeURIComponent(link);
    // Only the hash is stored.
    expect(await countRows("password_reset_tokens", `token_hash = '${resetToken}'`)).toBe(0);

    await resetPassword(anon(), { token: resetToken, password: "Brand-new-pass-2" });
    expect(await validateSessionToken(session)).toBeNull();
    await expectCode(login(anon(), { email: "r@example.test", password: PASSWORD }), "VALIDATION_ERROR");
    await login(anon(), { email: "r@example.test", password: "Brand-new-pass-2" });

    const reuse = await expectCode(resetPassword(anon(), { token: resetToken, password: "Another-pass-3" }), "VALIDATION_ERROR");
    expect(reuse.message).toMatch(/invalid or has expired/);
    await login(anon(), { email: "r@example.test", password: "Brand-new-pass-2" });
  });

  it("does not reveal whether an email exists", async () => {
    await expect(requestPasswordReset(anon(), { email: "ghost@example.test" })).resolves.toBeUndefined();
    expect(mail.sent).toHaveLength(0);
  });

  it("rejects an unknown token", async () => {
    await expectCode(resetPassword(anon(), { token: "x".repeat(43), password: "Brand-new-pass-2" }), "VALIDATION_ERROR");
  });
});

describe("change password", () => {
  it("requires the current password and revokes all sessions", async () => {
    const u = await createUser({ email: "c@example.test" });
    const a = await login(anon(), { email: "c@example.test", password: PASSWORD });
    const b = await login(anon(), { email: "c@example.test", password: PASSWORD }, "mobile");
    const ctx = { ...ctxOf(u), sessionToken: a.token };

    const wrong = await expectCode(changePassword(ctx, { currentPassword: "nope-nope-1", newPassword: "Changed-pass-9" }), "VALIDATION_ERROR");
    expect(wrong.fieldErrors?.currentPassword).toBeDefined();
    expect(await validateSessionToken(a.token)).not.toBeNull();

    await changePassword(ctx, { currentPassword: PASSWORD, newPassword: "Changed-pass-9" });
    expect(await validateSessionToken(a.token)).toBeNull();
    expect(await validateSessionToken(b.token)).toBeNull();
    await expectCode(login(anon(), { email: "c@example.test", password: PASSWORD }), "VALIDATION_ERROR");
    await login(anon(), { email: "c@example.test", password: "Changed-pass-9" });
  });

  it("requires authentication", async () => {
    await expectCode(changePassword(ctxOf(null), { currentPassword: PASSWORD, newPassword: "Changed-pass-9" }), "UNAUTHENTICATED");
  });
});
