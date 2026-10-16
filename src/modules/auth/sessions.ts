import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb, type Tx } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "locafy_session";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  platformRole: "user" | "admin" | "super_admin";
  status: "active" | "suspended" | "deleted";
};

export async function createSession(
  tx: Tx,
  userId: string,
  opts: { client: "web" | "mobile"; ip?: string | null; userAgent?: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_DAYS * 86_400_000);
  await tx.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    client: opts.client,
    ip: opts.ip ?? null,
    userAgent: opts.userAgent?.slice(0, 300) ?? null,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Resolve a raw session token to its user. Returns null for unknown, expired,
 * or non-active accounts (suspended users are signed out everywhere).
 */
export async function validateSessionToken(token: string): Promise<{ user: SessionUser; sessionId: string } | null> {
  if (!token || token.length > 128) return null;
  const db = getDb();
  const rows = await db
    .select({
      sessionId: sessions.id,
      lastUsedAt: sessions.lastUsedAt,
      user: {
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        platformRole: users.platformRole,
        status: users.status,
      },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.status !== "active") return null;

  // Touch at most hourly to avoid a write on every request.
  if (Date.now() - row.lastUsedAt.getTime() > 3_600_000) {
    await db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, row.sessionId));
  }
  return { user: row.user, sessionId: row.sessionId };
}

export async function revokeSessionToken(token: string) {
  await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function revokeAllSessions(tx: Tx, userId: string) {
  await tx.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions() {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
