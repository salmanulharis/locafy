import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { LinkTabs, NoAccess } from "@/components/merchant/misc";
import { roleAllows } from "@/modules/access/permissions";
import { listCategories } from "@/modules/catalog/service";
import { onboardingGaps } from "@/modules/shops/service";
import { loadShop, requireMerchant, sp, type SearchParams } from "../../_lib/data";
import { AddressForm, ContactForm, DetailsForm, PhotosForm, ShopStatusBanner, STEPS, VerificationForm, type StepKey } from "../_components/shop-forms";

export const metadata: Metadata = { title: "Shop settings" };

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: SearchParams }) {
  const { shopId } = await params;
  const q = await searchParams;
  await requireMerchant(`/merchant/${shopId}/settings`);
  const { shop, role, branches } = await loadShop(shopId);
  if (!roleAllows(role, "shop.edit")) return <NoAccess what="editing the shop profile" />;

  const tab = (STEPS.find((s) => s.key === sp(q.tab))?.key ?? "details") as StepKey;
  const [categories, gaps] = await Promise.all([
    tab === "details" ? listCategories({ scope: "shop" }).then((c) => c.filter((x) => !x.parentId)) : Promise.resolve([]),
    tab === "verification" ? onboardingGaps(shopId) : Promise.resolve([]),
  ]);
  const primary = branches.find((b) => b.isPrimary);
  const readOnly = shop.status === "suspended";
  const others = branches.filter((b) => !b.isPrimary);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Shop settings"
        description="Changes are saved to your shop profile straight away."
        actions={
          shop.status === "active" ? (
            <Link href={`/s/${shop.slug}`} className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary hover:bg-surface-2">
              View public page <ExternalLink className="size-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />
      <div className="mb-4">
        <ShopStatusBanner shop={shop} shopId={shopId} />
      </div>
      <LinkTabs
        label="Settings sections"
        items={STEPS.map((s) => ({ href: `/merchant/${shopId}/settings?tab=${s.key}`, label: s.label, active: s.key === tab }))}
      />
      <Card className="p-4 sm:p-6">
        <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
          {tab === "details" && <DetailsForm shop={shop} categories={categories} />}
          {tab === "address" && (
            <>
              <AddressForm shop={shop} branch={primary} />
              {others.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <h3 className="font-semibold">Other branches</h3>
                  <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                    {others.map((b) => (
                      <li key={b.id}>
                        {b.name} · {[b.addressLine, b.city].filter(Boolean).join(", ")}
                        {!b.isActive && " (inactive)"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
          {tab === "contact" && <ContactForm shop={shop} branch={primary} />}
          {tab === "photos" && <PhotosForm shop={shop} readOnly={readOnly} />}
          {tab === "verification" && <VerificationForm shop={shop} gaps={gaps} canSubmit={roleAllows(role, "shop.submit")} />}
        </fieldset>
      </Card>
    </div>
  );
}
