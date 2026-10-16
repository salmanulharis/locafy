import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { listPublicPlans } from "@/modules/subscriptions/plans";

export const metadata: Metadata = { title: "Plans for shops" };

const fmt = (n: number) => (n < 0 ? "Unlimited" : n.toLocaleString("en-IN"));
const storage = (mb: number) => (mb < 0 ? "Unlimited" : mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`);

export default async function PricingPage() {
  const plans = await listPublicPlans();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader title="Plans for shops" description="Every approved shop is discoverable for free. Paid plans add capacity and tools." />
      <Alert tone="info" className="mb-6">
        Online payment isn&apos;t available yet. To move to a paid plan, contact the Locafy team from your shop dashboard.
      </Alert>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const e = p.entitlements;
          const rows: [string, string | boolean][] = [
            ["product listings", fmt(e.maxListings)],
            ["media storage", storage(e.maxStorageMb)],
            ["branches", fmt(e.maxBranches)],
            ["team members", fmt(e.maxStaff)],
            ["active offers", fmt(e.maxActiveOffers)],
            ["Schedule offers in advance", e.promotionScheduling],
            ["Advanced analytics", e.advancedAnalytics],
            ["Bulk import", e.bulkImport],
            ["Sponsored placement access", e.sponsoredPlacements],
          ];
          return (
            <li key={p.id}>
              <Card className="flex h-full flex-col gap-4 p-5">
                <div>
                  <h2 className="text-heading font-semibold">{p.name}</h2>
                  <p className="mt-1 text-sm text-muted">{p.description}</p>
                </div>
                <p>
                  <span className="text-2xl font-semibold text-strong tabular">{p.priceMinor ? formatMoney(p.priceMinor, p.currency) : "Free"}</span>
                  {p.priceMinor ? <span className="text-sm text-muted"> / {p.interval}</span> : null}
                </p>
                <ul className="flex flex-col gap-2 text-sm">
                  {rows.map(([label, v]) => (
                    <li key={label} className="flex items-start gap-2">
                      {v === false ? <Minus className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> : <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />}
                      {typeof v === "string" ? (
                        <span>
                          <span className="font-medium">{v}</span> {label}
                        </span>
                      ) : (
                        <span className={v ? "" : "text-muted"}>
                          {label}
                          {!v && <span className="sr-only"> (not included)</span>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 text-center">
        <LinkButton href="/merchant/new">List your shop for free</LinkButton>
      </div>
    </div>
  );
}
