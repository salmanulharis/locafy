/**
 * Fixtures for integration tests. Everything is created through the real
 * services (same path as the app) except where a test needs a state the
 * services deliberately cannot produce (e.g. a branch without coordinates).
 */
import { hash } from "@node-rs/argon2";
import { and, eq, sql } from "drizzle-orm";
import { expect } from "vitest";
import { getDb, getSql } from "@/db/client";
import * as schema from "@/db/schema";
import { AppError, type ErrorCode } from "@/lib/errors";
import { systemCtx, type Ctx } from "@/modules/auth/context";
import type { SessionUser } from "@/modules/auth/sessions";
import { decideShop } from "@/modules/administration/service";
import { createListing } from "@/modules/listings/service";
import { clearSynonymCache } from "@/modules/search/service";
import { createShop, savePrimaryBranch, submitVerification, updateShopContact } from "@/modules/shops/service";

export const PASSWORD = "Test-pass-123";

/** Reference tables seeded by the base seed (plus PostGIS's own table); never truncated. */
const KEEP = new Set(["categories", "plans", "search_synonyms", "localities", "spatial_ref_sys"]);

/** Edappally, Kochi. */
export const ORIGIN = { lat: 10.0261, lng: 76.3125 };
/** Degrees of latitude per kilometre (approx). */
export const KM_LAT = 1 / 111.195;

export function north(km: number, from = ORIGIN) {
  return { lat: from.lat + km * KM_LAT, lng: from.lng };
}

let seq = 0;
export function uniq(prefix = "t") {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

let cachedHash: Promise<string> | undefined;
const passwordHash = () => (cachedHash ??= hash(PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 }));

export async function truncateAll() {
  const sqlc = getSql();
  const rows = await sqlc<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public'`;
  const tables = rows.map((r) => r.tablename).filter((t) => !KEEP.has(t));
  if (tables.length) await sqlc.unsafe(`truncate table ${tables.map((t) => `"${t}"`).join(", ")} restart identity cascade`);
  clearSynonymCache();
}

export async function createUser(
  opts: { name?: string; email?: string; role?: SessionUser["platformRole"]; status?: SessionUser["status"] } = {},
): Promise<SessionUser> {
  const [u] = await getDb()
    .insert(schema.users)
    .values({
      email: opts.email ?? `${uniq("user")}@example.test`,
      name: opts.name ?? "Test User",
      platformRole: opts.role ?? "user",
      status: opts.status ?? "active",
      passwordHash: await passwordHash(),
    })
    .returning();
  return { id: u!.id, email: u!.email, name: u!.name, phone: u!.phone, platformRole: u!.platformRole, status: u!.status };
}

export const createAdmin = (role: "admin" | "super_admin" = "super_admin") =>
  createUser({ name: `Admin ${role}`, role });

export function ctxOf(user: SessionUser | null, ip: string | null = null): Ctx {
  return { ...systemCtx(user), ip };
}

const categoryCache = new Map<string, string>();
export async function categoryId(slug: string) {
  const hit = categoryCache.get(slug);
  if (hit) return hit;
  const c = await getDb().query.categories.findFirst({ where: eq(schema.categories.slug, slug) });
  if (!c) throw new Error(`Missing category ${slug}`);
  categoryCache.set(slug, c.id);
  return c.id;
}

export type BranchInput = { lat: number; lng: number; city?: string };

/** Draft shop with category + primary branch + contact (complete, not yet submitted). */
export async function createCompleteDraftShop(owner: SessionUser, opts: { name?: string; at?: BranchInput } = {}) {
  const ctx = ctxOf(owner);
  const shop = await createShop(ctx, {
    name: opts.name ?? `Shop ${uniq()}`,
    categoryId: await categoryId("mobiles"),
    description: "Integration test shop",
  });
  const at: BranchInput = opts.at ?? ORIGIN;
  await savePrimaryBranch(ctx, shop.id, {
    name: "Main store",
    addressLine: "1 Test Road",
    city: at.city ?? "Kochi",
    postalCode: "682024",
    lat: at.lat,
    lng: at.lng,
  });
  await updateShopContact(ctx, shop.id, { phone: "+91 98470 00000" });
  const branch = await getDb().query.branches.findFirst({
    where: and(eq(schema.branches.shopId, shop.id), eq(schema.branches.isPrimary, true)),
  });
  return { shop, branchId: branch!.id };
}

/** createShop -> savePrimaryBranch -> updateShopContact -> submitVerification -> admin approve. */
export async function createActiveShop(owner: SessionUser, admin: SessionUser, opts: { name?: string; at?: BranchInput } = {}) {
  const { shop, branchId } = await createCompleteDraftShop(owner, opts);
  await submitVerification(ctxOf(owner), shop.id, { verificationNote: "GSTIN 32ABCDE1234F1Z5" });
  await decideShop(ctxOf(admin), shop.id, "approve");
  const fresh = await getDb().query.shops.findFirst({ where: eq(schema.shops.id, shop.id) });
  return { shop: fresh!, branchId };
}

export type ProductSpec = {
  name: string;
  brand?: string;
  model?: string;
  variant?: string;
  category?: string;
  aliases?: string[];
  specs?: Record<string, string>;
};

export async function createListingFor(
  owner: SessionUser,
  shopId: string,
  branchId: string,
  product: ProductSpec,
  opts: { price?: string | number; mrp?: string; quantity?: number; stockStatus?: "in_stock" | "low_stock" | "out_of_stock" | "unknown"; publish?: boolean } = {},
) {
  return createListing(ctxOf(owner), shopId, {
    product: {
      name: product.name,
      brand: product.brand,
      model: product.model,
      variant: product.variant,
      categoryId: await categoryId(product.category ?? "smartphones"),
      specs: product.specs ?? {},
      aliases: product.aliases ?? [],
    },
    stock: [
      {
        branchId,
        price: String(opts.price ?? "1000"),
        mrp: opts.mrp,
        quantity: opts.quantity,
        stockStatus: opts.stockStatus,
      },
    ],
    publish: opts.publish ?? true,
  });
}

export async function inventoryRow(listingId: string, branchId?: string) {
  const rows = await getDb()
    .select()
    .from(schema.inventory)
    .where(branchId ? and(eq(schema.inventory.listingId, listingId), eq(schema.inventory.branchId, branchId)) : eq(schema.inventory.listingId, listingId));
  if (!rows[0]) throw new Error("inventory row not found");
  return rows[0];
}

export async function planId(code: string) {
  const p = await getDb().query.plans.findFirst({ where: eq(schema.plans.code, code) });
  if (!p) throw new Error(`Missing plan ${code}`);
  return p.id;
}

export async function countRows(table: string, where = "true") {
  const rows = await getDb().execute<{ n: number }>(sql.raw(`select count(*)::int as n from "${table}" where ${where}`));
  return Number(rows[0]?.n ?? 0);
}

/** Await a promise and assert it rejects with an AppError of the given code. */
export async function expectCode(p: Promise<unknown>, code: ErrorCode): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    expect(e.code, `expected ${code}, got ${e.code}: ${e.message}`).toBe(code);
    return e;
  }
  throw new Error(`Expected rejection with ${code}, but the call succeeded`);
}

/** Wait for fire-and-forget writes (analytics, search logs) to settle. */
export const settle = (ms = 50) => new Promise((r) => setTimeout(r, ms));
