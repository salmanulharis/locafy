import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { formatDate, NoAccess, UsageBar } from "@/components/merchant/misc";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/primitives";
import type { Entitlements } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { roleAllows } from "@/modules/access/permissions";
import { LIMIT_LABELS, mergeEntitlements, type FeatureFlag, type NumericLimit } from "@/modules/subscriptions/entitlements";
import { getPlanOverview } from "@/modules/subscriptions/merchant";
import { loadShop, merchantCtx, requireMerchant } from "../../_lib/data";

export const metadata: Metadata = { title: "Plan" };

const LIMITS: NumericLimit[] = ["maxListings", "maxActiveOffers", "maxBranches", "maxStaff", "maxStorageMb"];
const FEATURES: Record<FeatureFlag, string> = {
  advancedAnalytics: "Advanced analytics",
  bulkImport: "Bulk product import",
  promotionScheduling: "Schedule offers in advance",
  sponsoredPlacements: "Sponsored placements",
};
const SUB_STATUS: Record<string, string> = { active: "Active", trialing: "Trial", past_due: "Payment overdue", canceled: "Cancelled" };

function limitText(ent: Entitlements, k: NumericLimit) {
  const v = ent[k];
  const unit = k === "maxStorageMb" ? "MB storage" : LIMIT_LABELS[k];
  return v < 0 ? `Unlimited ${unit}` : `${v} ${unit}`;
}

function price(p: { priceMinor: number; currency: string; interval: string }) {
  return p.priceMinor === 0 ? "Free" : `${formatMoney(p.priceMinor, p.currency)} / ${p.interval}`;
}

export default async function PlanPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  await requireMerchant(`/merchant/${shopId}/plan`);
  const ctx = await merchantCtx();
  const { role } = await loadShop(shopId);
  if (!roleAllows(role, "subscription.view")) return <NoAccess what="viewing the plan" />;
  const o = await getPlanOverview(ctx, shopId);
  const others = o.plans.filter((p) => p.id !== o.plan?.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Plan" description="Your plan sets how many products, offers and team members your shop can have." />

      <Card className="flex flex-col gap-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <h2 className="text-title font-semibold">{o.plan?.name ?? "Free"}</h2>
            {o.plan?.description && <p className="mt-1 text-sm text-muted">{o.plan.description}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular">{o.plan ? price(o.plan) : "Free"}</p>
            {o.subscription ? (
              <p className="text-sm text-muted">
                <Badge tone={o.subscription.status === "past_due" ? "warning" : "success"}>{SUB_STATUS[o.subscription.status] ?? o.subscription.status}</Badge>
                {o.subscription.currentPeriodEnd && <> · current period ends {formatDate(o.subscription.currentPeriodEnd)}</>}
              </p>
            ) : (
              <p className="text-sm text-muted">Default plan for new shops</p>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {LIMITS.map((k) => (
            <UsageBar
              key={k}
              label={k === "maxStorageMb" ? "Media storage" : LIMIT_LABELS[k]}
              used={o.usage[k]}
              max={o.entitlements[k]}
              unit={k === "maxStorageMb" ? "MB" : undefined}
            />
          ))}
        </div>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {(Object.keys(FEATURES) as FeatureFlag[]).map((f) => (
            <li key={f} className="flex min-h-8 items-center gap-2">
              {o.entitlements[f] ? <Check className="size-4 text-success-soft-fg" aria-hidden /> : <Minus className="size-4 text-muted" aria-hidden />}
              <span className={o.entitlements[f] ? "" : "text-muted"}>
                {FEATURES[f]}
                <span className="sr-only">{o.entitlements[f] ? ": included" : ": not included"}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Alert tone="info" title="Upgrading">
        Online payment isn&apos;t available yet. To change your plan, contact the Locafy team and we&apos;ll set it up for your shop. You won&apos;t be charged through this page.
      </Alert>

      {others.length > 0 && (
        <section aria-labelledby="plans-h" className="flex flex-col gap-3">
          <h2 id="plans-h" className="text-heading font-semibold">
            Other plans
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => (
              <Card key={p.id} className="flex flex-col gap-3 p-4">
                <div>
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="text-lg font-semibold tabular">{price(p)}</p>
                  {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {LIMITS.map((k) => (
                    <li key={k} className="first-letter:uppercase">
                      {limitText(mergeEntitlements(p.entitlements), k)}
                    </li>
                  ))}
                  {(Object.keys(FEATURES) as FeatureFlag[])
                    .filter((f) => p.entitlements[f])
                    .map((f) => (
                      <li key={f} className="flex items-center gap-1.5">
                        <Check className="size-4 text-success-soft-fg" aria-hidden /> {FEATURES[f]}
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
