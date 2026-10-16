import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MessageSquare, Package, Plus, Store } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ShopLogo } from "@/components/shops/shop-card";
import { ShopStatusBadge } from "@/components/merchant/status";
import { listMyShops, MAX_SHOPS_PER_OWNER } from "@/modules/shops/service";
import { requireMerchant } from "./_lib/data";

export const metadata: Metadata = { title: "My shops" };

const NEXT_STEP: Record<string, string> = {
  draft: "Finish setting up and submit for review",
  pending: "Under review by Locafy — we'll notify you",
  active: "Live on Locafy",
  rejected: "Changes requested — update and resubmit",
  suspended: "Suspended — contact Locafy support",
};

export default async function MerchantHome() {
  const ctx = await requireMerchant("/merchant");
  const shops = await listMyShops(ctx);
  const owned = shops.filter((s) => s.role === "owner").length;

  if (shops.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div className="flex flex-col items-start gap-4 sm:items-center sm:text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-fg">
            <Store className="size-7" aria-hidden />
          </span>
          <h1 className="text-display font-semibold tracking-tight text-balance">Get your shop found by nearby customers</h1>
          <p className="max-w-xl text-muted">
            Create a free storefront on Locafy, list what you sell with prices and stock, and let people nearby find you before they travel.
          </p>
          <LinkButton href="/merchant/new" size="lg" icon={<Plus className="size-5" aria-hidden />}>
            Create your shop
          </LinkButton>
        </div>
        <ol className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Store, title: "1. Set up your shop", text: "Name, address with a map pin, phone and opening hours." },
            { icon: Package, title: "2. Add products", text: "Pick from the shared catalogue or add your own, with price and stock." },
            { icon: MessageSquare, title: "3. Get enquiries", text: "Customers ask about availability; reply from your dashboard." },
          ].map((s) => (
            <li key={s.title}>
              <Card className="flex h-full flex-col gap-2 p-4">
                <s.icon className="size-5 text-primary" aria-hidden />
                <h2 className="font-semibold">{s.title}</h2>
                <p className="text-sm text-muted">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-sm text-muted sm:text-center">
          Every shop is reviewed by Locafy before it goes live. Products you add stay as drafts until then.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <PageHeader
        title="My shops"
        description="Shops you own or help manage."
        actions={
          owned < MAX_SHOPS_PER_OWNER ? (
            <LinkButton href="/merchant/new" variant="outline" icon={<Plus className="size-4" aria-hidden />}>
              Add a shop
            </LinkButton>
          ) : undefined
        }
      />
      <ul className="flex flex-col gap-3">
        {shops.map((s) => (
          <li key={s.id}>
            <Card className="relative flex items-center gap-3 p-3 transition-shadow hover:shadow-md sm:p-4">
              <ShopLogo src={s.logoUrl} name={s.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold">
                    <Link href={s.status === "draft" ? `/merchant/${s.id}/onboarding` : `/merchant/${s.id}`} className="after:absolute after:inset-0 hover:text-primary">
                      {s.name}
                    </Link>
                  </h2>
                  <ShopStatusBadge status={s.status} />
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  <span>
                    <span className="capitalize">{s.role}</span> · {NEXT_STEP[s.status]}
                  </span>
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
            </Card>
          </li>
        ))}
      </ul>
      {owned >= MAX_SHOPS_PER_OWNER && <p className="mt-4 text-sm text-muted">You own the maximum of {MAX_SHOPS_PER_OWNER} shops.</p>}
    </div>
  );
}
