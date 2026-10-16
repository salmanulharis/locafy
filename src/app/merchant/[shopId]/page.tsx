import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CheckCircle2, ChevronRight, Circle, Plus } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, StatTile } from "@/components/ui/primitives";
import { UsageBar } from "@/components/merchant/misc";
import { roleAllows } from "@/modules/access/permissions";
import { shopStats } from "@/modules/analytics/service";
import { openEnquiryCount } from "@/modules/enquiries/service";
import { STALE_AFTER_DAYS } from "@/modules/inventory/rules";
import { listingHealth } from "@/modules/listings/service";
import { listShopOffers } from "@/modules/offers/service";
import { onboardingGaps } from "@/modules/shops/service";
import { LIMIT_LABELS, type NumericLimit } from "@/modules/subscriptions/entitlements";
import { getPlanUsage } from "@/modules/subscriptions/merchant";
import { loadShop, merchantCtx, requireMerchant } from "../_lib/data";
import { ShopStatusBanner, STEPS, stepDone } from "./_components/shop-forms";

export const metadata: Metadata = { title: "Dashboard" };

const LIMIT_ORDER: NumericLimit[] = ["maxListings", "maxActiveOffers", "maxBranches", "maxStaff", "maxStorageMb"];

export default async function DashboardPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  await requireMerchant(`/merchant/${shopId}`);
  const ctx = await merchantCtx();
  const data = await loadShop(shopId);
  const { shop, role } = data;
  const base = `/merchant/${shopId}`;
  const canAnalytics = roleAllows(role, "analytics.view");
  const canEnquiries = roleAllows(role, "enquiry.respond");

  const [health, openCount, offers, stats, plan, gaps] = await Promise.all([
    listingHealth(shopId),
    canEnquiries ? openEnquiryCount(shopId) : Promise.resolve(null),
    listShopOffers(ctx, shopId),
    canAnalytics ? shopStats(ctx, shopId, { days: 30 }) : Promise.resolve(null),
    getPlanUsage(ctx, shopId),
    shop.status === "active" ? Promise.resolve([]) : onboardingGaps(shopId),
  ]);
  const activeOffers = offers.filter((o) => o.phase === "active").length;
  const done = stepDone(data);
  const noProducts = health.published + health.drafts === 0;
  const t = (k: keyof NonNullable<typeof stats>["byType"]) => stats?.byType[k]?.total ?? 0;
  const views = t("listing_view") + t("shop_view");
  const hasActivity = stats ? Object.values(stats.byType).some((v) => (v?.total ?? 0) > 0) : false;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={shop.name}
        description="Overview of your shop on Locafy."
        actions={
          roleAllows(role, "listing.manage") ? (
            <LinkButton href={`${base}/products/new`} icon={<Plus className="size-4" aria-hidden />}>
              Add product
            </LinkButton>
          ) : undefined
        }
      />

      {shop.status !== "active" && (
        <div className="flex flex-col gap-3">
          <ShopStatusBanner shop={shop} shopId={shopId} gaps={gaps} compact />
          {["draft", "rejected"].includes(shop.status) && roleAllows(role, "shop.edit") && (
            <Card className="p-4">
              <h2 className="font-semibold">Setup checklist</h2>
              <ol className="mt-2 flex flex-col">
                {STEPS.map((s) => (
                  <li key={s.key}>
                    <Link href={`${base}/onboarding?step=${s.n}`} className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm hover:bg-surface-2">
                      {done[s.key] ? (
                        <CheckCircle2 className="size-5 shrink-0 text-success-soft-fg" aria-hidden />
                      ) : (
                        <Circle className="size-5 shrink-0 text-muted" aria-hidden />
                      )}
                      <span className={done[s.key] ? "text-muted line-through" : "font-medium"}>{s.label}</span>
                      <span className="sr-only">{done[s.key] ? "done" : "to do"}</span>
                      {s.key === "photos" && !done.photos && <span className="text-xs text-muted">(optional)</span>}
                      <ChevronRight className="ml-auto size-4 text-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}

      <section aria-labelledby="products-h" className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <h2 id="products-h" className="text-heading font-semibold">
            Products
          </h2>
          <Link href={`${base}/products`} className="text-sm font-medium text-primary hover:underline">
            Manage products
          </Link>
        </div>
        {noProducts ? (
          <Card>
            <EmptyState
              title="No products yet"
              description="Add the products you sell with price and stock so nearby customers can find them."
              action={
                roleAllows(role, "listing.manage") ? (
                  <LinkButton href={`${base}/products/new`} icon={<Plus className="size-4" aria-hidden />}>
                    Add your first product
                  </LinkButton>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Link href={`${base}/products?status=published`} className="rounded-xl focus-visible:outline-2">
              <StatTile label="Published" value={health.published} />
            </Link>
            <Link href={`${base}/products?status=draft`} className="rounded-xl">
              <StatTile label="Drafts" value={health.drafts} />
            </Link>
            <Link href={`${base}/products?stock=low_stock`} className="rounded-xl">
              <StatTile label="Low stock" value={health.low_stock} tone={health.low_stock ? "warning" : undefined} />
            </Link>
            <Link href={`${base}/products?stock=out_of_stock`} className="rounded-xl">
              <StatTile label="Out of stock" value={health.out_of_stock} tone={health.out_of_stock ? "danger" : undefined} />
            </Link>
            <Link href={`${base}/products?stock=stale`} className="col-span-2 rounded-xl lg:col-span-1">
              <StatTile label="Need a stock check" value={health.stale} hint={`Not updated in ${STALE_AFTER_DAYS}+ days`} tone={health.stale ? "warning" : undefined} />
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="engage-h" className="flex flex-col gap-3">
        <h2 id="engage-h" className="text-heading font-semibold">
          Customers
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {openCount !== null && (
            <Link href={`${base}/enquiries?status=open`} className="rounded-xl">
              <StatTile label="Enquiries awaiting reply" value={openCount} tone={openCount ? "warning" : undefined} />
            </Link>
          )}
          <Link href={`${base}/offers`} className="rounded-xl">
            <StatTile label="Active offers" value={activeOffers} />
          </Link>
        </div>
      </section>

      {stats && (
        <section aria-labelledby="stats-h" className="flex flex-col gap-3">
          <div className="flex items-end justify-between">
            <h2 id="stats-h" className="text-heading font-semibold">
              Last 30 days
            </h2>
            <Link href={`${base}/analytics`} className="text-sm font-medium text-primary hover:underline">
              Analytics
            </Link>
          </div>
          {hasActivity ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Page views" value={views} hint="Shop and product pages" />
              <StatTile label="Enquiries received" value={t("enquiry")} />
              <StatTile label="Contact clicks" value={t("contact_click")} hint="Call, WhatsApp, email" />
              <StatTile label="Direction requests (not confirmed visits)" value={t("direction_request")} />
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<BarChart3 className="size-5" />}
                title="No customer activity recorded yet"
                description={shop.status === "active" ? "Views and clicks appear here as customers find your products." : "Activity is recorded once your shop is live."}
              />
            </Card>
          )}
        </section>
      )}

      <section aria-labelledby="plan-h" className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <h2 id="plan-h" className="text-heading font-semibold">
            Plan usage <span className="font-normal text-muted">· {plan.planName}</span>
          </h2>
          {roleAllows(role, "subscription.view") && (
            <Link href={`${base}/plan`} className="text-sm font-medium text-primary hover:underline">
              Plan details
            </Link>
          )}
        </div>
        <Card className="grid gap-4 p-4 sm:grid-cols-2">
          {LIMIT_ORDER.map((k) => (
            <UsageBar
              key={k}
              label={k === "maxStorageMb" ? "Media storage" : LIMIT_LABELS[k]}
              used={plan.usage[k]}
              max={plan.entitlements[k]}
              unit={k === "maxStorageMb" ? "MB" : undefined}
            />
          ))}
        </Card>
      </section>
    </div>
  );
}
