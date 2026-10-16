/**
 * Locafy database schema (Drizzle). PostgreSQL + PostGIS.
 *
 * Core identity separation (see docs/architecture.md):
 *   catalog_products  – shared product identity (brand + model + variant)
 *   listings          – one shop's offer of a catalog product
 *   inventory         – branch-specific price & stock for a listing
 *   offers            – time-bounded promotions over listings
 *   inventory_history – append-only log of price / stock changes
 *
 * Status columns are `text` with CHECK constraints (not pg enums) so new states
 * can be added with a simple constraint migration.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Custom column types
// ---------------------------------------------------------------------------

export type GeoPoint = { lat: number; lng: number };

/** PostGIS geography(Point, 4326). Written as EWKT, read back via ST_AsText in queries. */
export const geographyPoint = customType<{ data: GeoPoint; driverData: string }>({
  dataType() {
    return "geography(Point,4326)";
  },
  toDriver(value) {
    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value) {
    // Default driver output is hex EWKB; queries that need coordinates select
    // ST_Y/ST_X explicitly. This decoder handles the hex EWKB point form.
    return decodeEwkbPoint(value);
  },
});

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

function decodeEwkbPoint(hex: string): GeoPoint {
  const buf = Buffer.from(hex, "hex");
  const le = buf[0] === 1;
  const type = le ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const hasSrid = (type & 0x20000000) !== 0;
  const offset = 5 + (hasSrid ? 4 : 0);
  const x = le ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
  const y = le ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
  return { lng: x, lat: y };
}

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export const USER_STATUSES = ["active", "suspended", "deleted"] as const;
export const PLATFORM_ROLES = ["user", "admin", "super_admin"] as const;

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: citext("email").notNull(),
    passwordHash: text("password_hash"),
    name: text("name").notNull(),
    phone: text("phone"),
    status: text("status", { enum: USER_STATUSES }).notNull().default("active"),
    platformRole: text("platform_role", { enum: PLATFORM_ROLES }).notNull().default("user"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    suspendedReason: text("suspended_reason"),
    deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    check("users_status_check", sql`${t.status} in ('active','suspended','deleted')`),
    check("users_role_check", sql`${t.platformRole} in ('user','admin','super_admin')`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the opaque token. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    client: text("client", { enum: ["web", "mobile"] }).notNull().default("web"),
    userAgent: text("user_agent"),
    ip: text("ip"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_token_hash_key").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("password_reset_token_hash_key").on(t.tokenHash)],
);

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    parentId: uuid("parent_id"),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /** Applies to product catalogue, shops, or both. */
    scope: text("scope", { enum: ["product", "shop", "both"] }).notNull().default("both"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("categories_slug_key").on(t.slug), index("categories_parent_idx").on(t.parentId)],
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("brands_slug_key").on(t.slug)],
);

/** Query-time synonym expansion, e.g. "mobile" -> {"phone","smartphone"}. */
export const searchSynonyms = pgTable(
  "search_synonyms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    term: text("term").notNull(),
    synonyms: text("synonyms").array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("search_synonyms_term_key").on(t.term)],
);

/** Reference localities for manual location selection when no geocoder is available. */
export const localities = pgTable(
  "localities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    district: text("district"),
    region: text("region"),
    countryCode: text("country_code").notNull(),
    postalCode: text("postal_code"),
    location: geographyPoint("location").notNull(),
    population: integer("population"),
  },
  (t) => [
    index("localities_location_gix").using("gist", t.location),
    index("localities_name_trgm").using("gin", sql`lower(${t.name}) gin_trgm_ops`),
  ],
);

// ---------------------------------------------------------------------------
// Shops
// ---------------------------------------------------------------------------

export const SHOP_STATUSES = ["draft", "pending", "active", "rejected", "suspended"] as const;
export const SHOP_ROLES = ["owner", "manager", "staff"] as const;

export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    status: text("status", { enum: SHOP_STATUSES }).notNull().default("draft"),
    isVerified: boolean("is_verified").notNull().default(false),
    statusReason: text("status_reason"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    website: text("website"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    /** Business registration / verification details submitted by the owner (private). */
    verificationNote: text("verification_note"),
    onboardingStep: smallint("onboarding_step").notNull().default(1),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("shops_slug_key").on(t.slug),
    index("shops_status_idx").on(t.status),
    index("shops_name_trgm").using("gin", sql`lower(${t.name}) gin_trgm_ops`),
    check("shops_status_check", sql`${t.status} in ('draft','pending','active','rejected','suspended')`),
  ],
);

export const shopMembers = pgTable(
  "shop_members",
  {
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: SHOP_ROLES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.shopId, t.userId] }),
    index("shop_members_user_idx").on(t.userId),
    check("shop_members_role_check", sql`${t.role} in ('owner','manager','staff')`),
  ],
);

export type OpeningHours = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", { open: string; close: string }[]>
>;

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    addressLine: text("address_line").notNull(),
    locality: text("locality"),
    city: text("city").notNull(),
    region: text("region"),
    postalCode: text("postal_code"),
    countryCode: text("country_code").notNull(),
    /** Nullable: a branch without valid coordinates is excluded from distance search. */
    location: geographyPoint("location"),
    phone: text("phone"),
    openingHours: jsonb("opening_hours").$type<OpeningHours>(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("branches_shop_idx").on(t.shopId),
    index("branches_location_gix").using("gist", t.location),
    uniqueIndex("branches_one_primary").on(t.shopId).where(sql`${t.isPrimary}`),
  ],
);

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const CATALOG_STATUSES = ["active", "restricted", "merged"] as const;

export const catalogProducts = pgTable(
  "catalog_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    model: text("model"),
    /** Distinguishes variants of the same model, e.g. "8GB / 128GB, Black". */
    variant: text("variant"),
    /** Normalised identity key: brand|model|variant (or name when model absent). */
    identityKey: text("identity_key").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    description: text("description"),
    specs: jsonb("specs").$type<Record<string, string>>().notNull().default({}),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    gtin: text("gtin"),
    status: text("status", { enum: CATALOG_STATUSES }).notNull().default("active"),
    mergedIntoId: uuid("merged_into_id"),
    /** Denormalised from name/brand/model/variant/aliases/category; maintained by the catalog service. */
    searchText: text("search_text").notNull().default(""),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(search_text, ''))`,
    ),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("catalog_products_slug_key").on(t.slug),
    uniqueIndex("catalog_products_identity_key").on(t.identityKey).where(sql`${t.status} <> 'merged'`),
    index("catalog_products_category_idx").on(t.categoryId),
    index("catalog_products_brand_idx").on(t.brandId),
    index("catalog_products_search_gin").using("gin", t.searchVector),
    index("catalog_products_search_trgm").using("gin", sql`${t.searchText} gin_trgm_ops`),
    check("catalog_products_status_check", sql`${t.status} in ('active','restricted','merged')`),
  ],
);

export const LISTING_STATUSES = [
  "draft",
  "published",
  "unpublished",
  "archived",
  "discontinued",
  "restricted",
] as const;

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    catalogProductId: uuid("catalog_product_id")
      .notNull()
      .references(() => catalogProducts.id, { onDelete: "restrict" }),
    status: text("status", { enum: LISTING_STATUSES }).notNull().default("draft"),
    /** Shop-specific notes (warranty, bundle contents). Product identity stays in the catalogue. */
    notes: text("notes"),
    restrictedReason: text("restricted_reason"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("listings_shop_product_key").on(t.shopId, t.catalogProductId),
    index("listings_product_status_idx").on(t.catalogProductId, t.status),
    index("listings_shop_status_idx").on(t.shopId, t.status),
    check(
      "listings_status_check",
      sql`${t.status} in ('draft','published','unpublished','archived','discontinued','restricted')`,
    ),
  ],
);

export const STOCK_STATUSES = ["in_stock", "low_stock", "out_of_stock", "unknown"] as const;

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    /** Price in minor currency units (e.g. paise). */
    priceMinor: integer("price_minor").notNull(),
    /** Optional MRP / list price for showing savings. */
    mrpMinor: integer("mrp_minor"),
    currency: text("currency").notNull(),
    /** Null when the merchant does not track exact quantities. */
    quantity: integer("quantity"),
    stockStatus: text("stock_status", { enum: STOCK_STATUSES }).notNull().default("unknown"),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
    stockUpdatedAt: timestamp("stock_updated_at", { withTimezone: true }).notNull().defaultNow(),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Optimistic concurrency token, incremented on every write. */
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("inventory_listing_branch_key").on(t.listingId, t.branchId),
    index("inventory_branch_idx").on(t.branchId),
    index("inventory_price_idx").on(t.priceMinor),
    check("inventory_price_positive", sql`${t.priceMinor} > 0`),
    check("inventory_mrp_valid", sql`${t.mrpMinor} is null or ${t.mrpMinor} >= ${t.priceMinor}`),
    check("inventory_quantity_nonneg", sql`${t.quantity} is null or ${t.quantity} >= 0`),
    check("inventory_threshold_nonneg", sql`${t.lowStockThreshold} >= 0`),
    check(
      "inventory_stock_status_check",
      sql`${t.stockStatus} in ('in_stock','low_stock','out_of_stock','unknown')`,
    ),
  ],
);

export const inventoryHistory = pgTable(
  "inventory_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    inventoryId: uuid("inventory_id")
      .notNull()
      .references(() => inventory.id, { onDelete: "cascade" }),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    source: text("source", { enum: ["manual", "import", "api", "system"] }).notNull().default("manual"),
    oldPriceMinor: integer("old_price_minor"),
    newPriceMinor: integer("new_price_minor"),
    oldQuantity: integer("old_quantity"),
    newQuantity: integer("new_quantity"),
    oldStockStatus: text("old_stock_status"),
    newStockStatus: text("new_stock_status"),
    createdAt: createdAt(),
  },
  (t) => [index("inventory_history_inventory_idx").on(t.inventoryId, t.createdAt)],
);

/** Media uploaded by shops; `bytes` feeds storage-limit entitlements. */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    createdAt: createdAt(),
  },
  (t) => [index("media_assets_shop_idx").on(t.shopId), uniqueIndex("media_assets_key").on(t.storageKey)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Either a catalogue image (shared) or a listing-specific image. */
    catalogProductId: uuid("catalog_product_id").references(() => catalogProducts.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("product_images_catalog_idx").on(t.catalogProductId),
    index("product_images_listing_idx").on(t.listingId),
    check("product_images_owner", sql`(${t.catalogProductId} is not null) or (${t.listingId} is not null)`),
  ],
);

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export const OFFER_STATUSES = ["draft", "published", "unpublished"] as const;
export const DISCOUNT_TYPES = ["percent", "amount_off", "fixed_price"] as const;

export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    conditions: text("conditions"),
    discountType: text("discount_type", { enum: DISCOUNT_TYPES }).notNull(),
    /** percent: 1..95, amount_off / fixed_price: minor units. */
    discountValue: integer("discount_value").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: OFFER_STATUSES }).notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("offers_shop_idx").on(t.shopId),
    index("offers_active_idx").on(t.status, t.startsAt, t.endsAt),
    check("offers_window", sql`${t.endsAt} > ${t.startsAt}`),
    check("offers_value_positive", sql`${t.discountValue} > 0`),
    check(
      "offers_percent_range",
      sql`${t.discountType} <> 'percent' or (${t.discountValue} between 1 and 95)`,
    ),
    check("offers_status_check", sql`${t.status} in ('draft','published','unpublished')`),
  ],
);

export const offerListings = pgTable(
  "offer_listings",
  {
    offerId: uuid("offer_id")
      .notNull()
      .references(() => offers.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.offerId, t.listingId] }), index("offer_listings_listing_idx").on(t.listingId)],
);

// ---------------------------------------------------------------------------
// Customer engagement
// ---------------------------------------------------------------------------

export const ENQUIRY_STATUSES = ["open", "responded", "closed"] as const;

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    status: text("status", { enum: ENQUIRY_STATUSES }).notNull().default("open"),
    /** Idempotency key supplied by the client to make duplicate submissions harmless. */
    clientRequestId: text("client_request_id"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("enquiries_shop_idx").on(t.shopId, t.status, t.lastMessageAt),
    index("enquiries_customer_idx").on(t.customerId, t.lastMessageAt),
    uniqueIndex("enquiries_idempotency_key").on(t.customerId, t.clientRequestId),
    check("enquiries_quantity_range", sql`${t.quantity} between 1 and 10000`),
    check("enquiries_status_check", sql`${t.status} in ('open','responded','closed')`),
  ],
);

export const enquiryMessages = pgTable(
  "enquiry_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enquiryId: uuid("enquiry_id")
      .notNull()
      .references(() => enquiries.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    senderRole: text("sender_role", { enum: ["customer", "merchant"] }).notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("enquiry_messages_enquiry_idx").on(t.enquiryId, t.createdAt)],
);

export const favouriteProducts = pgTable(
  "favourite_products",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    catalogProductId: uuid("catalog_product_id")
      .notNull()
      .references(() => catalogProducts.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.catalogProductId] })],
);

export const favouriteShops = pgTable(
  "favourite_shops",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.shopId] })],
);

export const REVIEW_STATUSES = ["published", "hidden", "removed"] as const;

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type", { enum: ["shop", "product"] }).notNull(),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    catalogProductId: uuid("catalog_product_id").references(() => catalogProducts.id, { onDelete: "cascade" }),
    rating: smallint("rating").notNull(),
    body: text("body"),
    status: text("status", { enum: REVIEW_STATUSES }).notNull().default("published"),
    merchantResponse: text("merchant_response"),
    merchantRespondedAt: timestamp("merchant_responded_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("reviews_one_per_shop").on(t.authorId, t.shopId).where(sql`${t.targetType} = 'shop'`),
    uniqueIndex("reviews_one_per_product")
      .on(t.authorId, t.catalogProductId)
      .where(sql`${t.targetType} = 'product'`),
    index("reviews_shop_idx").on(t.shopId, t.status),
    index("reviews_product_idx").on(t.catalogProductId, t.status),
    check("reviews_rating_range", sql`${t.rating} between 1 and 5`),
    check(
      "reviews_target",
      sql`(${t.targetType} = 'shop' and ${t.shopId} is not null and ${t.catalogProductId} is null) or (${t.targetType} = 'product' and ${t.catalogProductId} is not null and ${t.shopId} is null)`,
    ),
    check("reviews_status_check", sql`${t.status} in ('published','hidden','removed')`),
  ],
);

// ---------------------------------------------------------------------------
// Trust & safety
// ---------------------------------------------------------------------------

export const REPORT_TARGETS = ["shop", "listing", "product", "review", "offer", "enquiry"] as const;
export const REPORT_STATUSES = ["open", "actioned", "dismissed"] as const;

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type", { enum: REPORT_TARGETS }).notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: text("status", { enum: REPORT_STATUSES }).notNull().default("open"),
    resolutionNote: text("resolution_note"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    index("reports_target_idx").on(t.targetType, t.targetId),
    check("reports_status_check", sql`${t.status} in ('open','actioned','dismissed')`),
  ],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moderatorId: uuid("moderator_id").references(() => users.id, { onDelete: "set null" }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    action: text("action").notNull(),
    reason: text("reason"),
    reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("moderation_actions_target_idx").on(t.targetType, t.targetId)],
);

// ---------------------------------------------------------------------------
// Subscriptions & advertising
// ---------------------------------------------------------------------------

export type Entitlements = {
  maxListings: number;
  maxStorageMb: number;
  maxBranches: number;
  maxStaff: number;
  maxActiveOffers: number;
  advancedAnalytics: boolean;
  bulkImport: boolean;
  promotionScheduling: boolean;
  sponsoredPlacements: boolean;
};

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    priceMinor: integer("price_minor").notNull().default(0),
    currency: text("currency").notNull(),
    interval: text("interval", { enum: ["month", "year"] }).notNull().default("month"),
    entitlements: jsonb("entitlements").$type<Entitlements>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("plans_code_key").on(t.code),
    uniqueIndex("plans_one_default").on(t.isDefault).where(sql`${t.isDefault}`),
  ],
);

export const SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "canceled"] as const;

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    status: text("status", { enum: SUBSCRIPTION_STATUSES }).notNull().default("active"),
    /** "manual" when assigned by an administrator; a payment provider name otherwise. */
    provider: text("provider").notNull().default("manual"),
    providerRef: text("provider_ref"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("subscriptions_shop_idx").on(t.shopId),
    uniqueIndex("subscriptions_one_live")
      .on(t.shopId)
      .where(sql`${t.status} in ('active','trialing','past_due')`),
  ],
);

/** Foundations only: placements are created by admins; no self-serve ad billing in the MVP. */
export const sponsoredPlacements = pgTable(
  "sponsored_placements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("sponsored_listing_idx").on(t.listingId, t.startsAt, t.endsAt),
    check("sponsored_window", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

// ---------------------------------------------------------------------------
// Notifications, analytics, audit, platform
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    /** Email delivery state; in-app delivery is the row itself. */
    emailStatus: text("email_status", { enum: ["not_required", "pending", "sent", "failed"] })
      .notNull()
      .default("not_required"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export type NotificationPreferences = {
  emailEnquiries: boolean;
  emailReviews: boolean;
  emailShopStatus: boolean;
  emailMarketing: boolean;
};

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  prefs: jsonb("prefs").$type<NotificationPreferences>().notNull(),
  updatedAt: updatedAt(),
});

export const ANALYTICS_EVENT_TYPES = [
  "product_impression",
  "listing_view",
  "product_view",
  "shop_view",
  "enquiry",
  "contact_click",
  "direction_request",
  "offer_view",
] as const;

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type", { enum: ANALYTICS_EVENT_TYPES }).notNull(),
    shopId: uuid("shop_id").references(() => shops.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "set null" }),
    catalogProductId: uuid("catalog_product_id").references(() => catalogProducts.id, { onDelete: "set null" }),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Hashed visitor fingerprint used only for de-duplication. */
    visitorHash: text("visitor_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("analytics_shop_type_time_idx").on(t.shopId, t.type, t.createdAt),
    index("analytics_listing_idx").on(t.listingId, t.type),
  ],
);

export const searchLogs = pgTable(
  "search_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    query: text("query").notNull(),
    resultCount: integer("result_count").notNull(),
    durationMs: integer("duration_ms").notNull(),
    hadLocation: boolean("had_location").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("search_logs_time_idx").on(t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_time_idx").on(t.createdAt),
    index("audit_logs_target_idx").on(t.targetType, t.targetId),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

/** Fixed-window rate limiting counters (works across instances without Redis). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export const errorLogs = pgTable(
  "error_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    requestId: text("request_id"),
    route: text("route"),
    message: text("message").notNull(),
    stack: text("stack"),
    createdAt: createdAt(),
  },
  (t) => [index("error_logs_time_idx").on(t.createdAt)],
);
