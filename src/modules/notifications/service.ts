import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Tx } from "@/db/client";
import { parseInput } from "@/lib/validation";
import { notificationPreferences, notifications, users, type NotificationPreferences } from "@/db/schema";
import { requireUser } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { sendMail } from "./mailer";

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnquiries: true,
  emailReviews: true,
  emailShopStatus: true,
  emailMarketing: false,
};

type PrefKey = keyof NotificationPreferences;

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  /** Preference that gates the email copy. In-app notifications are always stored. */
  emailPref?: PrefKey;
};

export async function getPreferences(tx: Tx, userId: string): Promise<NotificationPreferences> {
  const row = await tx.query.notificationPreferences.findFirst({
    where: eq(notificationPreferences.userId, userId),
  });
  return { ...DEFAULT_PREFERENCES, ...(row?.prefs ?? {}) };
}

/**
 * Store an in-app notification inside the caller's transaction. Email delivery
 * happens after commit via `deliverPendingEmails` so a mail failure can never
 * roll back the business operation; failures are recorded as `failed`.
 */
export async function notify(tx: Tx, input: NotifyInput) {
  const prefs = input.emailPref ? await getPreferences(tx, input.userId) : null;
  const wantsEmail = input.emailPref ? prefs![input.emailPref] : false;
  const [row] = await tx
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      emailStatus: wantsEmail ? "pending" : "not_required",
    })
    .returning({ id: notifications.id });
  return row!.id;
}

export async function deliverPendingEmails(limit = 50) {
  const db = getDb();
  const pending = await db
    .select({ id: notifications.id, title: notifications.title, body: notifications.body, link: notifications.link, email: users.email })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(eq(notifications.emailStatus, "pending"))
    .limit(limit);
  for (const n of pending) {
    let status: "sent" | "failed" = "sent";
    try {
      await sendMail({ to: n.email, subject: n.title, text: [n.body, n.link].filter(Boolean).join("\n\n") });
    } catch {
      status = "failed";
    }
    await db.update(notifications).set({ emailStatus: status }).where(eq(notifications.id, n.id));
  }
  return pending.length;
}

export async function listNotifications(ctx: Ctx, opts: { limit?: number } = {}) {
  const user = requireUser(ctx);
  const db = getDb();
  const [items, unread] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(Math.min(opts.limit ?? 30, 100)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
  ]);
  return { items, unreadCount: unread[0]?.n ?? 0 };
}

export async function unreadCount(ctx: Ctx): Promise<number> {
  if (!ctx.actor) return 0;
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, ctx.actor.id), isNull(notifications.readAt)));
  return rows[0]?.n ?? 0;
}

export async function markAllRead(ctx: Ctx) {
  const user = requireUser(ctx);
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
}

export async function updatePreferences(ctx: Ctx, prefs: Partial<NotificationPreferences>) {
  const user = requireUser(ctx);
  const db = getDb();
  const merged = { ...(await getPreferences(db, user.id)), ...prefs };
  await db
    .insert(notificationPreferences)
    .values({ userId: user.id, prefs: merged })
    .onConflictDoUpdate({ target: notificationPreferences.userId, set: { prefs: merged, updatedAt: new Date() } });
  return merged;
}

/** The caller's notification preferences (defaults merged in). */
export async function getMyPreferences(ctx: Ctx): Promise<NotificationPreferences> {
  const user = requireUser(ctx);
  return getPreferences(getDb(), user.id);
}

const preferencesInputSchema = z
  .object({
    emailEnquiries: z.boolean(),
    emailReviews: z.boolean(),
    emailShopStatus: z.boolean(),
    emailMarketing: z.boolean(),
  })
  .partial()
  .strict();

/** Validated partial update of the caller's preferences; returns the merged result. */
export async function updateMyPreferences(ctx: Ctx, input: unknown): Promise<NotificationPreferences> {
  const prefs = parseInput(preferencesInputSchema, input ?? {});
  return updatePreferences(ctx, prefs);
}
