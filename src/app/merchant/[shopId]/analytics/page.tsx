import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { DailyBarChart, DailyTable } from "@/components/merchant/bar-chart";
import { LinkTabs, NoAccess } from "@/components/merchant/misc";
import { Alert, Card, EmptyState, PageHeader, StatTile } from "@/components/ui/primitives";
import { roleAllows } from "@/modules/access/permissions";
import { shopStats, type EventType } from "@/modules/analytics/service";
import { loadShop, merchantCtx, requireMerchant, sp, type SearchParams } from "../../_lib/data";

export const metadata: Metadata = { title: "Analytics" };

const METRICS: { type: EventType; label: string; hint: string }[] = [
  { type: "product_impression", label: "Impressions", hint: "Times your products appeared in search results" },
  { type: "listing_view", label: "Product page views", hint: "Opened one of your products" },
  { type: "shop_view", label: "Shop page views", hint: "Opened your shop page" },
  { type: "enquiry", label: "Enquiries", hint: "Messages sent to your shop" },
  { type: "contact_click", label: "Contact clicks", hint: "Tapped call, WhatsApp or email" },
  { type: "direction_request", label: "Direction requests", hint: "Opened directions — not a confirmed visit or sale" },
  { type: "offer_view", label: "Offer views", hint: "Saw one of your offers" },
];

export default async function AnalyticsPage({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: SearchParams }) {
  const { shopId } = await params;
  const q = await searchParams;
  await requireMerchant(`/merchant/${shopId}/analytics`);
  const ctx = await merchantCtx();
  const { role } = await loadShop(shopId);
  if (!roleAllows(role, "analytics.view")) return <NoAccess what="analytics" />;
  const days = [7, 30, 90].includes(Number(sp(q.days))) ? Number(sp(q.days)) : 30;
  const stats = await shopStats(ctx, shopId, { days });
  const base = `/merchant/${shopId}/analytics`;
  const total = (t: EventType) => stats.byType[t]?.total ?? 0;
  const unique = (t: EventType) => stats.byType[t]?.unique ?? 0;
  const hasData = METRICS.some((m) => total(m.type) > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" description="Counts of what customers did on Locafy. Recorded events only — nothing is estimated." />
      <LinkTabs
        label="Time range"
        items={[7, 30, 90].map((d) => ({ href: d === 30 ? base : `${base}?days=${d}`, label: `Last ${d} days`, active: d === days }))}
      />

      {!hasData ? (
        <Card>
          <EmptyState
            icon={<BarChart3 className="size-5" />}
            title={`No activity in the last ${days} days`}
            description="Once customers see and open your published products, the numbers appear here."
          />
        </Card>
      ) : (
        <>
          <section aria-labelledby="totals-h" className="flex flex-col gap-3">
            <h2 id="totals-h" className="text-heading font-semibold">
              Totals
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {METRICS.map((m) => (
                <StatTile
                  key={m.type}
                  label={m.type === "direction_request" ? "Direction requests (not confirmed visits)" : m.label}
                  value={total(m.type)}
                  hint={`${m.hint}${total(m.type) ? ` · about ${unique(m.type)} unique visitor${unique(m.type) === 1 ? "" : "s"}` : ""}`}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="daily-h" className="flex flex-col gap-3">
            <h2 id="daily-h" className="text-heading font-semibold">
              Day by day
            </h2>
            <Card className="flex flex-col gap-6 p-4">
              <DailyBarChart title="Page views (shop and products)" unit="views" data={stats.daily.map((d) => ({ day: d.day, value: d.views }))} />
              <DailyBarChart
                title="Customer actions (enquiries, contact clicks, direction requests)"
                unit="actions"
                data={stats.daily.map((d) => ({ day: d.day, value: d.actions }))}
              />
              <DailyTable rows={stats.daily} />
            </Card>
          </section>

          <section aria-labelledby="top-h" className="flex flex-col gap-3">
            <h2 id="top-h" className="text-heading font-semibold">
              Top products
            </h2>
            {stats.topProducts.length === 0 ? (
              <Card>
                <EmptyState title="No product activity yet" />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <caption className="sr-only">Products with the most page views in the period</caption>
                  <thead className="border-b border-border bg-surface-2 text-left text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Views</th>
                      <th scope="col" className="px-4 py-2.5 text-right font-medium">Impressions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.topProducts.map((p) => (
                      <tr key={p.listingId ?? p.name}>
                        <td className="px-4 py-2.5">
                          {p.listingId ? (
                            <Link href={`/merchant/${shopId}/products/${p.listingId}`} className="font-medium hover:text-primary">
                              {p.name}
                            </Link>
                          ) : (
                            p.name
                          )}
                          {p.variant && <span className="block text-xs text-muted">{p.variant}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular">{p.views}</td>
                        <td className="px-4 py-2.5 text-right tabular">{p.impressions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        </>
      )}

      <Alert tone="info" title="How to read these numbers">
        Impressions count how often your products appeared in search results. A direction request means a customer opened directions to your shop — it is not a confirmed visit or sale. Unique visitors are approximate and reset daily for privacy.
      </Alert>
    </div>
  );
}
