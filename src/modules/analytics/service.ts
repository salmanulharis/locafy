import { createHash } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { analyticsEvents, catalogProducts, listings, ANALYTICS_EVENT_TYPES } from "@/db/schema";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requireShopPermission } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { enforceRateLimit } from "@/modules/platform/rate-limit";

export type EventType = (typeof ANALYTICS_EVENT_TYPES)[number];

type EventInput = {
  type: EventType;
  shopId?: string | null;
  listingId?: string | null;
  catalogProductId?: string | null;
  offerId?: string | null;
};

function visitorHash(ctx: Ctx): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${ctx.ip ?? ""}|${ctx.userAgent ?? ""}|${day}`).digest("hex").slice(0, 32);
}

/**
 * Record analytics events. Never throws (analytics must not break user flows).
 * Visitor identity is a daily-rotating hash, never a raw IP.
 */
export async function recordEvents(events: EventInput[], ctx: Ctx) {
  if (!events.length) return;
  try {
    const vh = visitorHash(ctx);
    await getDb()
      .insert(analyticsEvents)
      .values(
        events.map((e) => ({
          type: e.type,
          shopId: e.shopId ?? null,
          listingId: e.listingId ?? null,
          catalogProductId: e.catalogProductId ?? null,
          offerId: e.offerId ?? null,
          userId: ctx.actor?.id ?? null,
          visitorHash: vh,
        })),
      );
  } catch {
    // swallow
  }
}

/** Client-reported events (contact clicks, direction requests). Only these types are accepted from clients. */
const clientEventSchema = z.object({
  type: z.enum(["contact_click", "direction_request", "offer_view"]),
  shopId: uuidSchema,
  listingId: uuidSchema.optional(),
  offerId: uuidSchema.optional(),
});

export async function recordClientEvent(ctx: Ctx, input: unknown) {
  const data = parseInput(clientEventSchema, input);
  await enforceRateLimit("event", ctx.ip);
  await recordEvents([data], ctx);
}

const statsSchema = z.object({ days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)).default(30) });

/**
 * Merchant analytics from recorded events only. A direction request is a
 * customer opening directions — not a confirmed visit or sale.
 */
export async function shopStats(ctx: Ctx, shopId: string, input: unknown = {}) {
  await requireShopPermission(ctx, shopId, "analytics.view");
  const { days } = parseInput(statsSchema, input);
  const since = new Date(Date.now() - days * 86_400_000);
  const db = getDb();
  const [totals, daily, topProducts] = await Promise.all([
    db
      .select({ type: analyticsEvents.type, n: sql<number>`count(*)::int`, unique: sql<number>`count(distinct ${analyticsEvents.visitorHash})::int` })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.shopId, shopId), gte(analyticsEvents.createdAt, since)))
      .groupBy(analyticsEvents.type),
    db.execute<{ day: string; views: number; actions: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day,
        coalesce(sum(case when e.type in ('listing_view','shop_view','product_view') then 1 else 0 end), 0)::int as views,
        coalesce(sum(case when e.type in ('contact_click','direction_request','enquiry') then 1 else 0 end), 0)::int as actions
      from generate_series(date_trunc('day', ${since.toISOString()}::timestamptz), date_trunc('day', now()), interval '1 day') d
      left join analytics_events e on e.shop_id = ${shopId} and date_trunc('day', e.created_at) = d
      group by d order by d`),
    db
      .select({
        listingId: analyticsEvents.listingId,
        name: catalogProducts.name,
        variant: catalogProducts.variant,
        views: sql<number>`count(*) filter (where ${analyticsEvents.type} = 'listing_view')::int`,
        impressions: sql<number>`count(*) filter (where ${analyticsEvents.type} = 'product_impression')::int`,
      })
      .from(analyticsEvents)
      .innerJoin(listings, eq(listings.id, analyticsEvents.listingId))
      .innerJoin(catalogProducts, eq(catalogProducts.id, listings.catalogProductId))
      .where(and(eq(analyticsEvents.shopId, shopId), gte(analyticsEvents.createdAt, since)))
      .groupBy(analyticsEvents.listingId, catalogProducts.name, catalogProducts.variant)
      .orderBy(desc(sql`count(*) filter (where ${analyticsEvents.type} = 'listing_view')`))
      .limit(10),
  ]);
  const byType = Object.fromEntries(totals.map((t) => [t.type, { total: t.n, unique: t.unique }])) as Partial<
    Record<EventType, { total: number; unique: number }>
  >;
  return { days, byType, daily: [...daily], topProducts };
}
