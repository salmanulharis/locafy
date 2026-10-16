import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { passwordResetTokens, users } from "@/db/schema";
import { env } from "@/lib/env";
import { errors, isUniqueViolation } from "@/lib/errors";
import { parseInput, phoneSchema } from "@/lib/validation";
import { requireUser } from "@/modules/access/permissions";
import { audit } from "@/modules/platform/audit";
import { enforceRateLimit } from "@/modules/platform/rate-limit";
import { sendMail } from "@/modules/notifications/mailer";
import type { Ctx } from "./context";
import { createSession, generateToken, hashToken, revokeAllSessions, revokeSessionToken } from "./sessions";

// OWASP-recommended argon2id parameters (19 MiB, t=2).
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// Constant-time-ish dummy verification target so unknown emails cost the same as wrong passwords.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hash("locafy-dummy-password", ARGON_OPTS));

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "Password is too long.")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), "Include at least one letter and one number.");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: passwordSchema,
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(200),
});

type Client = "web" | "mobile";

export async function register(ctx: Ctx, input: unknown, client: Client = "web") {
  const data = parseInput(registerSchema, input);
  await enforceRateLimit("register", ctx.ip);
  const passwordHash = await hash(data.password, ARGON_OPTS);
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: data.name, email: data.email, phone: data.phone ?? null, passwordHash })
        .returning({ id: users.id, email: users.email, name: users.name });
      const session = await createSession(tx, user!.id, { client, ip: ctx.ip, userAgent: ctx.userAgent });
      await audit(tx, { ...ctx, actor: null }, { action: "user.register", targetType: "user", targetId: user!.id });
      return { user: user!, ...session };
    });
  } catch (e) {
    if (isUniqueViolation(e, "users_email_key")) {
      throw errors.validation("An account with this email already exists.", {
        email: ["An account with this email already exists. Try signing in."],
      });
    }
    throw e;
  }
}

export async function login(ctx: Ctx, input: unknown, client: Client = "web") {
  const data = parseInput(loginSchema, input);
  await enforceRateLimit("login", `${ctx.ip}:${data.email}`);
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.email, data.email) });
  const ok = await verify(user?.passwordHash ?? (await getDummyHash()), data.password).catch(() => false);
  if (!user || !user.passwordHash || !ok) {
    throw errors.validation("Email or password is incorrect.", { _form: ["Email or password is incorrect."] });
  }
  if (user.status === "suspended") {
    throw errors.forbidden("This account is suspended. Contact support if you believe this is a mistake.");
  }
  if (user.status !== "active") throw errors.validation("Email or password is incorrect.");
  const session = await createSession(db, user.id, { client, ip: ctx.ip, userAgent: ctx.userAgent });
  return {
    user: { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole },
    ...session,
  };
}

export async function logout(ctx: Ctx) {
  if (ctx.sessionToken) await revokeSessionToken(ctx.sessionToken);
}

export async function me(ctx: Ctx) {
  const user = requireUser(ctx);
  return user;
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  phone: phoneSchema.optional(),
});

export async function updateProfile(ctx: Ctx, input: unknown) {
  const user = requireUser(ctx);
  const data = parseInput(profileSchema, input);
  await getDb()
    .update(users)
    .set({ name: data.name, phone: data.phone ?? null, updatedAt: new Date() })
    .where(eq(users.id, user.id));
}

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

export async function changePassword(ctx: Ctx, input: unknown) {
  const actor = requireUser(ctx);
  const data = parseInput(changePasswordSchema, input);
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, actor.id) });
  if (!user?.passwordHash || !(await verify(user.passwordHash, data.currentPassword))) {
    throw errors.validation("Current password is incorrect.", { currentPassword: ["Current password is incorrect."] });
  }
  const passwordHash = await hash(data.newPassword, ARGON_OPTS);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    // Sign out other devices; the caller re-authenticates below.
    await revokeAllSessions(tx, user.id);
    await audit(tx, ctx, { action: "user.password_change", targetType: "user", targetId: user.id });
  });
}

/** Always succeeds from the caller's perspective to avoid account enumeration. */
export async function requestPasswordReset(ctx: Ctx, input: unknown) {
  const { email } = parseInput(z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address.") }), input);
  await enforceRateLimit("passwordReset", ctx.ip);
  const db = getDb();
  const user = await db.query.users.findFirst({ where: and(eq(users.email, email), eq(users.status, "active")) });
  if (!user) return;
  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const link = `${env().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: "Reset your Locafy password",
    text: `Use this link within 60 minutes to set a new password:\n\n${link}\n\nIf you did not request this, ignore this email.`,
  }).catch(() => {});
}

export async function resetPassword(ctx: Ctx, input: unknown) {
  const data = parseInput(z.object({ token: z.string().min(10).max(200), password: passwordSchema }), input);
  const db = getDb();
  const passwordHash = await hash(data.password, ARGON_OPTS);
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, hashToken(data.token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });
    if (!row) throw errors.validation("This reset link is invalid or has expired.", { _form: ["This reset link is invalid or has expired."] });
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, row.userId));
    await revokeAllSessions(tx, row.userId);
    await audit(tx, ctx, { action: "user.password_reset", targetType: "user", targetId: row.userId });
  });
}

/** Customer-initiated deletion request; an administrator completes it (see administration module). */
export async function requestAccountDeletion(ctx: Ctx) {
  const user = requireUser(ctx);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ deletionRequestedAt: new Date() }).where(eq(users.id, user.id));
    await audit(tx, ctx, { action: "user.deletion_requested", targetType: "user", targetId: user.id });
  });
}

export async function cancelAccountDeletion(ctx: Ctx) {
  const user = requireUser(ctx);
  await getDb().update(users).set({ deletionRequestedAt: null }).where(eq(users.id, user.id));
}

export { ARGON_OPTS };

/** The caller's own account details (fresh from the database; no secrets). */
export async function myAccount(ctx: Ctx) {
  const actor = requireUser(ctx);
  const user = await getDb().query.users.findFirst({
    where: eq(users.id, actor.id),
    columns: {
      id: true,
      email: true,
      name: true,
      phone: true,
      platformRole: true,
      status: true,
      emailVerifiedAt: true,
      deletionRequestedAt: true,
      createdAt: true,
    },
  });
  if (!user) throw errors.unauthenticated();
  return user;
}

/** The signed-in user's own account record (no secrets). */
export async function getAccount(ctx: Ctx) {
  const actor = requireUser(ctx);
  const user = await getDb().query.users.findFirst({
    where: eq(users.id, actor.id),
    columns: { id: true, name: true, email: true, phone: true, createdAt: true, deletionRequestedAt: true, platformRole: true },
  });
  if (!user) throw errors.unauthenticated();
  return user;
}
