/**
 * DEVELOPMENT / DEMO DATA ONLY. Creates clearly-labelled demo accounts, shops
 * and listings around Kochi so the app can be explored locally.
 * Refuses to run when NODE_ENV=production.  Usage: pnpm db:seed:demo
 *
 * All demo shop names start with "Demo" and descriptions state they are demo
 * data; prices and stock are illustrative, not real market information.
 */
import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../../src/db/client";
import * as schema from "../../src/db/schema";
import { systemCtx } from "../../src/modules/auth/context";
import type { SessionUser } from "../../src/modules/auth/sessions";
import { decideShop, setShopVerified } from "../../src/modules/administration/service";
import { createListing } from "../../src/modules/listings/service";
import { createOffer } from "../../src/modules/offers/service";
import { upsertReview } from "../../src/modules/reviews/service";
import { createShop, savePrimaryBranch, submitVerification, updateShopContact } from "../../src/modules/shops/service";

export const DEMO_PASSWORD = "Demo-pass-123";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

async function user(email: string, name: string, role: SessionUser["platformRole"] = "user"): Promise<SessionUser> {
  const db = getDb();
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (existing) return existing as SessionUser;
  const [u] = await db
    .insert(schema.users)
    .values({ email, name, platformRole: role, passwordHash: await hash(DEMO_PASSWORD, { memoryCost: 19456, timeCost: 2 }) })
    .returning();
  return u as SessionUser;
}

async function categoryId(slug: string) {
  const c = await getDb().query.categories.findFirst({ where: eq(schema.categories.slug, slug) });
  if (!c) throw new Error(`Missing category ${slug}; run pnpm db:seed first`);
  return c.id;
}

type DemoProduct = {
  name: string;
  brand?: string;
  model?: string;
  variant?: string;
  category: string;
  specs?: Record<string, string>;
  price: number;
  mrp?: number;
  qty?: number;
  status?: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
};

const PHONES: DemoProduct[] = [
  { name: "Samsung Galaxy A55 5G", brand: "Samsung", model: "Galaxy A55", variant: "8GB RAM / 128GB, Awesome Navy", category: "smartphones", specs: { RAM: "8 GB", Storage: "128 GB", Display: "6.6 inch AMOLED", Battery: "5000 mAh" }, price: 39999, mrp: 42999, qty: 6 },
  { name: "Samsung Galaxy A55 5G", brand: "Samsung", model: "Galaxy A55", variant: "8GB RAM / 256GB, Awesome Iceblue", category: "smartphones", specs: { RAM: "8 GB", Storage: "256 GB", Display: "6.6 inch AMOLED", Battery: "5000 mAh" }, price: 42999, mrp: 45999, qty: 2 },
  { name: "Redmi Note 13", brand: "Xiaomi", model: "Redmi Note 13", variant: "6GB / 128GB", category: "smartphones", specs: { RAM: "6 GB", Storage: "128 GB" }, price: 16999, qty: 10 },
  { name: "Anker 20W USB-C Charger", brand: "Anker", model: "A2149", category: "chargers-cables", specs: { Output: "20 W", Connector: "USB-C" }, price: 1299, mrp: 1799, qty: 25 },
  { name: "boAt Airdopes 141", brand: "boAt", model: "Airdopes 141", variant: "Bold Black", category: "headphones", specs: { Type: "True wireless", Playback: "42 hours" }, price: 1099, mrp: 4490, status: "in_stock" },
];

const GROCERY: DemoProduct[] = [
  { name: "Aashirvaad Shudh Chakki Atta", brand: "Aashirvaad", model: "Shudh Chakki Atta", variant: "5 kg", category: "rice-grains", price: 285, mrp: 310, qty: 40 },
  { name: "Aashirvaad Shudh Chakki Atta", brand: "Aashirvaad", model: "Shudh Chakki Atta", variant: "10 kg", category: "rice-grains", price: 545, mrp: 595, qty: 3 },
  { name: "Eastern Sambar Powder", brand: "Eastern", model: "Sambar Powder", variant: "100 g", category: "spices", price: 42, qty: 60 },
  { name: "Matta Rice (Kerala Red Rice)", brand: "Nirapara", model: "Matta Rice", variant: "5 kg", category: "rice-grains", price: 360, status: "unknown" },
  { name: "Milma Ghee", brand: "Milma", model: "Ghee", variant: "500 ml", category: "dairy", price: 375, qty: 0 },
];

const HARDWARE: DemoProduct[] = [
  { name: "Bosch GSB 500 RE Impact Drill", brand: "Bosch", model: "GSB 500 RE", category: "power-tools", specs: { Power: "500 W", Chuck: "13 mm" }, price: 2899, mrp: 3599, qty: 4 },
  { name: "Philips LED Bulb 9W", brand: "Philips", model: "Stellar Bright 9W", variant: "Cool Day Light", category: "electricals", specs: { Wattage: "9 W", Base: "B22" }, price: 99, mrp: 140, qty: 120 },
  { name: "Anker 20W USB-C Charger", brand: "Anker", model: "A2149", category: "chargers-cables", specs: { Output: "20 W", Connector: "USB-C" }, price: 1199, qty: 8 },
];

async function seedShop(opts: {
  owner: SessionUser;
  admin: SessionUser;
  name: string;
  category: string;
  description: string;
  branch: { addressLine: string; locality: string; city: string; postalCode: string; lat: number; lng: number };
  phone: string;
  products: DemoProduct[];
  verified?: boolean;
  /** Days ago the stock was last confirmed (to demonstrate freshness labels). */
  stockAgeDays?: number;
}) {
  const db = getDb();
  const existing = await db.query.shops.findFirst({ where: eq(schema.shops.name, opts.name) });
  if (existing) return existing.id;
  const ctx = systemCtx(opts.owner);
  const shop = await createShop(ctx, { name: opts.name, categoryId: await categoryId(opts.category), description: opts.description });
  await savePrimaryBranch(ctx, shop.id, { ...opts.branch, name: "Main store" });
  await updateShopContact(ctx, shop.id, {
    phone: opts.phone,
    whatsapp: opts.phone,
    openingHours: Object.fromEntries(
      ["mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, [{ open: "09:30", close: "20:30" }]]),
    ),
  });
  await submitVerification(ctx, shop.id, { verificationNote: "DEMO — GSTIN placeholder for local development" });
  await decideShop(systemCtx(opts.admin), shop.id, "approve");
  if (opts.verified) await setShopVerified(systemCtx(opts.admin), shop.id, true);

  const branch = await db.query.branches.findFirst({ where: eq(schema.branches.shopId, shop.id) });
  for (const p of opts.products) {
    await createListing(ctx, shop.id, {
      product: {
        name: p.name,
        brand: p.brand,
        model: p.model,
        variant: p.variant,
        categoryId: await categoryId(p.category),
        specs: p.specs ?? {},
        aliases: [],
      },
      stock: [{ branchId: branch!.id, price: String(p.price), mrp: p.mrp ? String(p.mrp) : undefined, quantity: p.qty, stockStatus: p.status }],
      publish: true,
    });
  }
  if (opts.stockAgeDays) {
    const ago = new Date(Date.now() - opts.stockAgeDays * 86_400_000);
    await db.update(schema.inventory).set({ stockUpdatedAt: ago }).where(eq(schema.inventory.branchId, branch!.id));
  }
  return shop.id;
}

async function main() {
  const admin = await user("admin@locafy.test", "Locafy Admin", "super_admin");
  const m1 = await user("merchant1@locafy.test", "Anil Kumar");
  const m2 = await user("merchant2@locafy.test", "Fathima Rahman");
  const m3 = await user("merchant3@locafy.test", "Joseph Mathew");
  const customer = await user("customer@locafy.test", "Priya Menon");

  const s1 = await seedShop({
    owner: m1, admin, name: "Demo Mobiles Edappally", category: "mobiles", verified: true,
    description: "Demo shop for local development. Smartphones and accessories.",
    branch: { addressLine: "NH 66, Near Lulu Junction", locality: "Edappally", city: "Kochi", postalCode: "682024", lat: 10.0273, lng: 76.3083 },
    phone: "+91 98470 00001", products: PHONES,
  });
  await seedShop({
    owner: m2, admin, name: "Demo Fresh Mart Kakkanad", category: "groceries",
    description: "Demo shop for local development. Daily groceries and Kerala staples.",
    branch: { addressLine: "Seaport-Airport Road", locality: "Kakkanad", city: "Kochi", postalCode: "682030", lat: 10.0159, lng: 76.3419 },
    phone: "+91 98470 00002", products: GROCERY,
  });
  await seedShop({
    owner: m3, admin, name: "Demo Hardware Vyttila", category: "hardware", stockAgeDays: 20,
    description: "Demo shop for local development. Tools, electricals and mobile chargers.",
    branch: { addressLine: "Vyttila Hub Road", locality: "Vyttila", city: "Kochi", postalCode: "682019", lat: 9.9677, lng: 76.3207 },
    phone: "+91 98470 00003", products: HARDWARE,
  });

  // One live offer on the phone shop.
  const db = getDb();
  const offerExists = await db.query.offers.findFirst({ where: eq(schema.offers.shopId, s1) });
  if (!offerExists) {
    const phoneListings = await db.select({ id: schema.listings.id }).from(schema.listings).where(eq(schema.listings.shopId, s1)).limit(2);
    await createOffer(
      systemCtx(m1),
      s1,
      {
        title: "Festive discount on Galaxy A55",
        description: "Limited period offer at the store.",
        conditions: "While stocks last. One per customer.",
        discountType: "percent",
        discountValue: 5,
        startsAt: new Date(Date.now() - 3_600_000).toISOString(),
        endsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        listingIds: phoneListings.map((l) => l.id),
      },
      true,
    );
  }
  await upsertReview(systemCtx(customer), { targetType: "shop", targetId: s1, rating: 5, body: "Helpful staff and the price matched what was listed." }).catch(() => {});

  console.log("Demo data ready. Accounts (password: %s):", DEMO_PASSWORD);
  console.log("  admin@locafy.test (super admin), merchant1..3@locafy.test, customer@locafy.test");
}

main()
  .then(() => closeDb())
  .catch(async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
