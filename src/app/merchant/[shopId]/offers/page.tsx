import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Tag } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDateTime, NoAccess } from "@/components/merchant/misc";
import { OFFER_PHASE_LABELS, OfferPhaseBadge } from "@/components/merchant/status";
import { formatMoney } from "@/lib/money";
import { roleAllows } from "@/modules/access/permissions";
import { describeOffer, type OfferPhase } from "@/modules/offers/rules";
import { listShopOffers } from "@/modules/offers/service";
import { loadShop, merchantCtx, requireMerchant } from "../../_lib/data";

export const metadata: Metadata = { title: "Offers" };

const ORDER: OfferPhase[] = ["active", "scheduled", "draft", "unpublished", "expired"];

export default async function OffersPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  await requireMerchant(`/merchant/${shopId}/offers`);
  const ctx = await merchantCtx();
  const { role, shop } = await loadShop(shopId);
  if (!roleAllows(role, "offer.manage")) return <NoAccess what="managing offers" />;
  const offers = await listShopOffers(ctx, shopId);
  const base = `/merchant/${shopId}/offers`;

  return (
    <div>
      <PageHeader
        title="Offers"
        description="Discounts customers see on your products and in “Offers near you”."
        actions={
          shop.status !== "suspended" ? (
            <LinkButton href={`${base}/new`} icon={<Plus className="size-4" aria-hidden />}>
              New offer
            </LinkButton>
          ) : undefined
        }
      />
      {offers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Tag className="size-5" />}
            title="No offers yet"
            description="Create a discount on one or more products. It's shown with your price while it's active."
            action={<LinkButton href={`${base}/new`}>Create an offer</LinkButton>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {ORDER.map((phase) => {
            const group = offers.filter((o) => o.phase === phase);
            if (!group.length) return null;
            return (
              <section key={phase} aria-labelledby={`ph-${phase}`} className="flex flex-col gap-2">
                <h2 id={`ph-${phase}`} className="text-sm font-semibold text-muted">
                  {OFFER_PHASE_LABELS[phase]} ({group.length})
                </h2>
                <ul className="flex flex-col gap-2">
                  {group.map((o) => (
                    <li key={o.id}>
                      <Card className="relative flex items-center gap-3 p-3 hover:shadow-md sm:p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`${base}/${o.id}`} className="font-semibold after:absolute after:inset-0 hover:text-primary">
                              {o.title}
                            </Link>
                            <OfferPhaseBadge phase={o.phase} />
                          </div>
                          <p className="mt-0.5 text-sm text-muted">
                            <span className="font-medium text-fg">{describeOffer(o.discountType, o.discountValue, (m) => formatMoney(m))}</span> · {o.listingCount} product
                            {o.listingCount === 1 ? "" : "s"} · {formatDateTime(o.startsAt)} – {formatDateTime(o.endsAt)}
                          </p>
                        </div>
                        <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
