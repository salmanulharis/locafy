CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"shop_id" uuid,
	"listing_id" uuid,
	"catalog_product_id" uuid,
	"offer_id" uuid,
	"user_id" uuid,
	"visitor_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"address_line" text NOT NULL,
	"locality" text,
	"city" text NOT NULL,
	"region" text,
	"postal_code" text,
	"country_code" text NOT NULL,
	"location" geography(Point,4326),
	"phone" text,
	"opening_hours" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand_id" uuid,
	"model" text,
	"variant" text,
	"identity_key" text NOT NULL,
	"category_id" uuid,
	"description" text,
	"specs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"gtin" text,
	"status" text DEFAULT 'active' NOT NULL,
	"merged_into_id" uuid,
	"search_text" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(search_text, ''))) STORED,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_products_status_check" CHECK ("catalog_products"."status" in ('active','restricted','merged'))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"scope" text DEFAULT 'both' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"listing_id" uuid,
	"customer_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"client_request_id" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiries_quantity_range" CHECK ("enquiries"."quantity" between 1 and 10000),
	CONSTRAINT "enquiries_status_check" CHECK ("enquiries"."status" in ('open','responded','closed'))
);
--> statement-breakpoint
CREATE TABLE "enquiry_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"sender_id" uuid,
	"sender_role" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" text,
	"route" text,
	"message" text NOT NULL,
	"stack" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favourite_products" (
	"user_id" uuid NOT NULL,
	"catalog_product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourite_products_user_id_catalog_product_id_pk" PRIMARY KEY("user_id","catalog_product_id")
);
--> statement-breakpoint
CREATE TABLE "favourite_shops" (
	"user_id" uuid NOT NULL,
	"shop_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favourite_shops_user_id_shop_id_pk" PRIMARY KEY("user_id","shop_id")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"price_minor" integer NOT NULL,
	"mrp_minor" integer,
	"currency" text NOT NULL,
	"quantity" integer,
	"stock_status" text DEFAULT 'unknown' NOT NULL,
	"low_stock_threshold" integer DEFAULT 3 NOT NULL,
	"stock_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_price_positive" CHECK ("inventory"."price_minor" > 0),
	CONSTRAINT "inventory_mrp_valid" CHECK ("inventory"."mrp_minor" is null or "inventory"."mrp_minor" >= "inventory"."price_minor"),
	CONSTRAINT "inventory_quantity_nonneg" CHECK ("inventory"."quantity" is null or "inventory"."quantity" >= 0),
	CONSTRAINT "inventory_threshold_nonneg" CHECK ("inventory"."low_stock_threshold" >= 0),
	CONSTRAINT "inventory_stock_status_check" CHECK ("inventory"."stock_status" in ('in_stock','low_stock','out_of_stock','unknown'))
);
--> statement-breakpoint
CREATE TABLE "inventory_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"inventory_id" uuid NOT NULL,
	"changed_by" uuid,
	"source" text DEFAULT 'manual' NOT NULL,
	"old_price_minor" integer,
	"new_price_minor" integer,
	"old_quantity" integer,
	"new_quantity" integer,
	"old_stock_status" text,
	"new_stock_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"catalog_product_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"restricted_reason" text,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_status_check" CHECK ("listings"."status" in ('draft','published','unpublished','archived','discontinued','restricted'))
);
--> statement-breakpoint
CREATE TABLE "localities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"district" text,
	"region" text,
	"country_code" text NOT NULL,
	"postal_code" text,
	"location" geography(Point,4326) NOT NULL,
	"population" integer
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid,
	"uploaded_by" uuid,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderator_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"report_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"prefs" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"email_status" text DEFAULT 'not_required' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offer_listings" (
	"offer_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	CONSTRAINT "offer_listings_offer_id_listing_id_pk" PRIMARY KEY("offer_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"conditions" text,
	"discount_type" text NOT NULL,
	"discount_value" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_window" CHECK ("offers"."ends_at" > "offers"."starts_at"),
	CONSTRAINT "offers_value_positive" CHECK ("offers"."discount_value" > 0),
	CONSTRAINT "offers_percent_range" CHECK ("offers"."discount_type" <> 'percent' or ("offers"."discount_value" between 1 and 95)),
	CONSTRAINT "offers_status_check" CHECK ("offers"."status" in ('draft','published','unpublished'))
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_minor" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"entitlements" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_product_id" uuid,
	"listing_id" uuid,
	"media_asset_id" uuid,
	"url" text NOT NULL,
	"alt" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_owner" CHECK (("product_images"."catalog_product_id" is not null) or ("product_images"."listing_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_status_check" CHECK ("reports"."status" in ('open','actioned','dismissed'))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"shop_id" uuid,
	"catalog_product_id" uuid,
	"rating" smallint NOT NULL,
	"body" text,
	"status" text DEFAULT 'published' NOT NULL,
	"merchant_response" text,
	"merchant_responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5),
	CONSTRAINT "reviews_target" CHECK (("reviews"."target_type" = 'shop' and "reviews"."shop_id" is not null and "reviews"."catalog_product_id" is null) or ("reviews"."target_type" = 'product' and "reviews"."catalog_product_id" is not null and "reviews"."shop_id" is null)),
	CONSTRAINT "reviews_status_check" CHECK ("reviews"."status" in ('published','hidden','removed'))
);
--> statement-breakpoint
CREATE TABLE "search_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"result_count" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"had_location" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"synonyms" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"client" text DEFAULT 'web' NOT NULL,
	"user_agent" text,
	"ip" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_members" (
	"shop_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_members_shop_id_user_id_pk" PRIMARY KEY("shop_id","user_id"),
	CONSTRAINT "shop_members_role_check" CHECK ("shop_members"."role" in ('owner','manager','staff'))
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"status_reason" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"website" text,
	"logo_url" text,
	"cover_url" text,
	"verification_note" text,
	"onboarding_step" smallint DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_status_check" CHECK ("shops"."status" in ('draft','pending','active','rejected','suspended'))
);
--> statement-breakpoint
CREATE TABLE "sponsored_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsored_window" CHECK ("sponsored_placements"."ends_at" > "sponsored_placements"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_ref" text,
	"current_period_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text,
	"name" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"platform_role" text DEFAULT 'user' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"suspended_reason" text,
	"deletion_requested_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('active','suspended','deleted')),
	CONSTRAINT "users_role_check" CHECK ("users"."platform_role" in ('user','admin','super_admin'))
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_catalog_product_id_catalog_products_id_fk" FOREIGN KEY ("catalog_product_id") REFERENCES "public"."catalog_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_messages" ADD CONSTRAINT "enquiry_messages_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiry_messages" ADD CONSTRAINT "enquiry_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite_products" ADD CONSTRAINT "favourite_products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite_products" ADD CONSTRAINT "favourite_products_catalog_product_id_catalog_products_id_fk" FOREIGN KEY ("catalog_product_id") REFERENCES "public"."catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite_shops" ADD CONSTRAINT "favourite_shops_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favourite_shops" ADD CONSTRAINT "favourite_shops_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_history" ADD CONSTRAINT "inventory_history_inventory_id_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_history" ADD CONSTRAINT "inventory_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_catalog_product_id_catalog_products_id_fk" FOREIGN KEY ("catalog_product_id") REFERENCES "public"."catalog_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_listings" ADD CONSTRAINT "offer_listings_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_listings" ADD CONSTRAINT "offer_listings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_catalog_product_id_catalog_products_id_fk" FOREIGN KEY ("catalog_product_id") REFERENCES "public"."catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_catalog_product_id_catalog_products_id_fk" FOREIGN KEY ("catalog_product_id") REFERENCES "public"."catalog_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_members" ADD CONSTRAINT "shop_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_placements" ADD CONSTRAINT "sponsored_placements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_placements" ADD CONSTRAINT "sponsored_placements_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsored_placements" ADD CONSTRAINT "sponsored_placements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_shop_type_time_idx" ON "analytics_events" USING btree ("shop_id","type","created_at");--> statement-breakpoint
CREATE INDEX "analytics_listing_idx" ON "analytics_events" USING btree ("listing_id","type");--> statement-breakpoint
CREATE INDEX "audit_logs_time_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "branches_shop_idx" ON "branches" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "branches_location_gix" ON "branches" USING gist ("location");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_one_primary" ON "branches" USING btree ("shop_id") WHERE "branches"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_key" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_products_slug_key" ON "catalog_products" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_products_identity_key" ON "catalog_products" USING btree ("identity_key") WHERE "catalog_products"."status" <> 'merged';--> statement-breakpoint
CREATE INDEX "catalog_products_category_idx" ON "catalog_products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "catalog_products_brand_idx" ON "catalog_products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "catalog_products_search_gin" ON "catalog_products" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "catalog_products_search_trgm" ON "catalog_products" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "enquiries_shop_idx" ON "enquiries" USING btree ("shop_id","status","last_message_at");--> statement-breakpoint
CREATE INDEX "enquiries_customer_idx" ON "enquiries" USING btree ("customer_id","last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "enquiries_idempotency_key" ON "enquiries" USING btree ("customer_id","client_request_id");--> statement-breakpoint
CREATE INDEX "enquiry_messages_enquiry_idx" ON "enquiry_messages" USING btree ("enquiry_id","created_at");--> statement-breakpoint
CREATE INDEX "error_logs_time_idx" ON "error_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_listing_branch_key" ON "inventory" USING btree ("listing_id","branch_id");--> statement-breakpoint
CREATE INDEX "inventory_branch_idx" ON "inventory" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "inventory_price_idx" ON "inventory" USING btree ("price_minor");--> statement-breakpoint
CREATE INDEX "inventory_history_inventory_idx" ON "inventory_history" USING btree ("inventory_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_shop_product_key" ON "listings" USING btree ("shop_id","catalog_product_id");--> statement-breakpoint
CREATE INDEX "listings_product_status_idx" ON "listings" USING btree ("catalog_product_id","status");--> statement-breakpoint
CREATE INDEX "listings_shop_status_idx" ON "listings" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "localities_location_gix" ON "localities" USING gist ("location");--> statement-breakpoint
CREATE INDEX "localities_name_trgm" ON "localities" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "media_assets_shop_idx" ON "media_assets" USING btree ("shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_key" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "offer_listings_listing_idx" ON "offer_listings" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "offers_shop_idx" ON "offers" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "offers_active_idx" ON "offers" USING btree ("status","starts_at","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_hash_key" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_code_key" ON "plans" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_one_default" ON "plans" USING btree ("is_default") WHERE "plans"."is_default";--> statement-breakpoint
CREATE INDEX "product_images_catalog_idx" ON "product_images" USING btree ("catalog_product_id");--> statement-breakpoint
CREATE INDEX "product_images_listing_idx" ON "product_images" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_shop" ON "reviews" USING btree ("author_id","shop_id") WHERE "reviews"."target_type" = 'shop';--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_one_per_product" ON "reviews" USING btree ("author_id","catalog_product_id") WHERE "reviews"."target_type" = 'product';--> statement-breakpoint
CREATE INDEX "reviews_shop_idx" ON "reviews" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("catalog_product_id","status");--> statement-breakpoint
CREATE INDEX "search_logs_time_idx" ON "search_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "search_synonyms_term_key" ON "search_synonyms" USING btree ("term");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shop_members_user_idx" ON "shop_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shops_slug_key" ON "shops" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "shops_status_idx" ON "shops" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shops_name_trgm" ON "shops" USING gin (lower("name") gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "sponsored_listing_idx" ON "sponsored_placements" USING btree ("listing_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "subscriptions_shop_idx" ON "subscriptions" USING btree ("shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_live" ON "subscriptions" USING btree ("shop_id") WHERE "subscriptions"."status" in ('active','trialing','past_due');--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");