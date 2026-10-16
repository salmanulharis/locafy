import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { catalogProducts, enquiries, enquiryMessages, listings, shopMembers, shops, users } from "@/db/schema";
import { errors, isUniqueViolation } from "@/lib/errors";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requireShopPermission, requireUser } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { recordEvents } from "@/modules/analytics/service";
import { notify } from "@/modules/notifications/service";
import { enforceRateLimit } from "@/modules/platform/rate-limit";
import { publicName } from "@/modules/products/service";
import { nextEnquiryStatus, type EnquiryStatus } from "./rules";

const createSchema = z.object({
  shopId: uuidSchema,
  listingId: uuidSchema.optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").max(10_000).default(1),
  message: z.string().trim().min(5, "Write a short message (at least 5 characters).").max(1000),
  clientRequestId: z.string().trim().max(64).optional(),
  /** Honeypot: real users never fill this hidden field. */
  website: z.string().max(0, "Spam detected.").optional(),
});

/** Very small heuristic spam screen; complements rate limiting. */
export function looksLikeSpam(text: string): boolean {
  const links = (text.match(/https?:\/\//gi) ?? []).length;
  return links > 2 || /(.)\1{15,}/.test(text);
}

export async function createEnquiry(ctx: Ctx, input: unknown) {
  const user = requireUser(ctx);
  const data = parseInput(createSchema, input);
  if (looksLikeSpam(data.message)) throw errors.validation("Your message looks like spam. Remove links and try again.");
  await enforceRateLimit("enquiryCreate", user.id);
  const db = getDb();
  try {
    const result = await db.transaction(async (tx) => {
      const shop = await tx.query.shops.findFirst({ where: and(eq(shops.id, data.shopId), eq(shops.status, "active")) });
      if (!shop) throw errors.notFound("Shop");
      const membership = await tx
        .select({ r: shopMembers.role })
        .from(shopMembers)
        .where(and(eq(shopMembers.shopId, shop.id), eq(shopMembers.userId, user.id)));
      if (membership[0]) throw errors.invalidState("You cannot send an enquiry to your own shop.");
      if (data.listingId) {
        const l = await tx
          .select({ id: listings.id })
          .from(listings)
          .where(and(eq(listings.id, data.listingId), eq(listings.shopId, shop.id), eq(listings.status, "published")));
        if (!l[0]) throw errors.notFound("Product");
      }
      const [enq] = await tx
        .insert(enquiries)
        .values({
          shopId: shop.id,
          listingId: data.listingId ?? null,
          customerId: user.id,
          quantity: data.quantity,
          clientRequestId: data.clientRequestId ?? null,
        })
        .returning();
      await tx.insert(enquiryMessages).values({ enquiryId: enq!.id, senderId: user.id, senderRole: "customer", body: data.message });
      const staff = await tx.select({ userId: shopMembers.userId }).from(shopMembers).where(eq(shopMembers.shopId, shop.id));
      for (const s of staff) {
        await notify(tx, {
          userId: s.userId,
          type: "enquiry.new",
          title: `New enquiry for ${shop.name}`,
          body: data.message.slice(0, 140),
          link: `/merchant/${shop.id}/enquiries/${enq!.id}`,
          emailPref: "emailEnquiries",
        });
      }
      return enq!;
    });
    void recordEvents([{ type: "enquiry", shopId: result.shopId, listingId: result.listingId }], ctx);
    return result;
  } catch (e) {
    // Duplicate submission (same clientRequestId): return the original enquiry.
    if (isUniqueViolation(e, "enquiries_idempotency_key") && data.clientRequestId) {
      const existing = await db.query.enquiries.findFirst({
        where: and(eq(enquiries.customerId, user.id), eq(enquiries.clientRequestId, data.clientRequestId)),
      });
      if (existing) return existing;
    }
    throw e;
  }
}

/** Load an enquiry the caller may access as customer or as shop staff. */
async function loadForParticipant(ctx: Ctx, enquiryId: string) {
  const user = requireUser(ctx);
  parseInput(uuidSchema, enquiryId);
  const db = getDb();
  const enq = await db.query.enquiries.findFirst({ where: eq(enquiries.id, enquiryId) });
  if (!enq) throw errors.notFound("Enquiry");
  if (enq.customerId === user.id) return { enq, as: "customer" as const, user };
  await requireShopPermission(ctx, enq.shopId, "enquiry.respond");
  return { enq, as: "merchant" as const, user };
}

const messageSchema = z.object({ body: z.string().trim().min(1, "Write a message.").max(2000) });

export async function replyToEnquiry(ctx: Ctx, enquiryId: string, input: unknown) {
  const { enq, as, user } = await loadForParticipant(ctx, enquiryId);
  const { body } = parseInput(messageSchema, input);
  if (as === "customer" && looksLikeSpam(body)) throw errors.validation("Your message looks like spam.");
  await enforceRateLimit("enquiryMessage", user.id);
  const next = nextEnquiryStatus(enq.status as EnquiryStatus, as === "merchant" ? "merchant_reply" : "customer_reply");
  if (!next) throw errors.invalidState("This enquiry is closed. Reopen it to continue the conversation.");
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.insert(enquiryMessages).values({ enquiryId, senderId: user.id, senderRole: as, body });
    await tx
      .update(enquiries)
      .set({ status: next, lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(enquiries.id, enquiryId));
    const shop = await tx.query.shops.findFirst({ where: eq(shops.id, enq.shopId) });
    if (as === "merchant") {
      await notify(tx, {
        userId: enq.customerId,
        type: "enquiry.reply",
        title: `${shop?.name ?? "The shop"} replied to your enquiry`,
        body: body.slice(0, 140),
        link: `/account/enquiries/${enquiryId}`,
        emailPref: "emailEnquiries",
      });
    } else {
      const staff = await tx.select({ userId: shopMembers.userId }).from(shopMembers).where(eq(shopMembers.shopId, enq.shopId));
      for (const s of staff) {
        await notify(tx, {
          userId: s.userId,
          type: "enquiry.customer_reply",
          title: `Customer replied to an enquiry`,
          body: body.slice(0, 140),
          link: `/merchant/${enq.shopId}/enquiries/${enquiryId}`,
        });
      }
    }
  });
}

export async function setEnquiryClosed(ctx: Ctx, enquiryId: string, closed: boolean) {
  const { enq } = await loadForParticipant(ctx, enquiryId);
  const next = nextEnquiryStatus(enq.status as EnquiryStatus, closed ? "close" : "reopen");
  if (!next) throw errors.invalidState(closed ? "This enquiry is already closed." : "This enquiry is not closed.");
  await getDb().update(enquiries).set({ status: next, updatedAt: new Date() }).where(eq(enquiries.id, enquiryId));
}

export async function getEnquiryThread(ctx: Ctx, enquiryId: string) {
  const { enq, as } = await loadForParticipant(ctx, enquiryId);
  const db = getDb();
  const [messages, meta] = await Promise.all([
    db
      .select({
        id: enquiryMessages.id,
        body: enquiryMessages.body,
        senderRole: enquiryMessages.senderRole,
        createdAt: enquiryMessages.createdAt,
        senderName: users.name,
      })
      .from(enquiryMessages)
      .leftJoin(users, eq(users.id, enquiryMessages.senderId))
      .where(eq(enquiryMessages.enquiryId, enquiryId))
      .orderBy(asc(enquiryMessages.createdAt)),
    db
      .select({
        shopName: shops.name,
        shopSlug: shops.slug,
        customerName: users.name,
        productName: catalogProducts.name,
        productVariant: catalogProducts.variant,
        productSlug: catalogProducts.slug,
      })
      .from(enquiries)
      .innerJoin(shops, eq(shops.id, enquiries.shopId))
      .innerJoin(users, eq(users.id, enquiries.customerId))
      .leftJoin(listings, eq(listings.id, enquiries.listingId))
      .leftJoin(catalogProducts, eq(catalogProducts.id, listings.catalogProductId))
      .where(eq(enquiries.id, enquiryId)),
  ]);
  const m = meta[0]!;
  return {
    enquiry: enq,
    viewerRole: as,
    shopName: m.shopName,
    shopSlug: m.shopSlug,
    // Merchants see the customer's first name + initial only; contact happens in-thread.
    customerName: publicName(m.customerName),
    product: m.productName ? { name: m.productName, variant: m.productVariant, slug: m.productSlug! } : null,
    messages: messages.map((msg) => ({
      ...msg,
      senderName: msg.senderRole === "customer" ? publicName(msg.senderName) : m.shopName,
    })),
  };
}

const listSchema = z.object({ status: z.enum(["open", "responded", "closed"]).optional() });

export async function listShopEnquiries(ctx: Ctx, shopId: string, input: unknown = {}) {
  await requireShopPermission(ctx, shopId, "enquiry.respond");
  const { status } = parseInput(listSchema, input);
  return listEnquiries(and(eq(enquiries.shopId, shopId), status ? eq(enquiries.status, status) : undefined));
}

export async function listMyEnquiries(ctx: Ctx) {
  const user = requireUser(ctx);
  return listEnquiries(eq(enquiries.customerId, user.id));
}

async function listEnquiries(where: ReturnType<typeof and>) {
  const rows = await getDb()
    .select({
      id: enquiries.id,
      status: enquiries.status,
      quantity: enquiries.quantity,
      createdAt: enquiries.createdAt,
      lastMessageAt: enquiries.lastMessageAt,
      shopId: shops.id,
      shopName: shops.name,
      customerName: users.name,
      productName: catalogProducts.name,
      productVariant: catalogProducts.variant,
      preview: sql<string>`(select m.body from enquiry_messages m where m.enquiry_id = ${enquiries.id} order by m.created_at desc limit 1)`,
    })
    .from(enquiries)
    .innerJoin(shops, eq(shops.id, enquiries.shopId))
    .innerJoin(users, eq(users.id, enquiries.customerId))
    .leftJoin(listings, eq(listings.id, enquiries.listingId))
    .leftJoin(catalogProducts, eq(catalogProducts.id, listings.catalogProductId))
    .where(where)
    .orderBy(desc(enquiries.lastMessageAt))
    .limit(100);
  return rows.map((r) => ({ ...r, customerName: publicName(r.customerName) }));
}

export async function openEnquiryCount(shopId: string) {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(enquiries)
    .where(and(eq(enquiries.shopId, shopId), inArray(enquiries.status, ["open"])));
  return rows[0]?.n ?? 0;
}
