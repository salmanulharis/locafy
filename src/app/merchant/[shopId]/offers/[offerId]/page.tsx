import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/action-form";
import { MerchantForm } from "@/components/merchant/merchant-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { BackLink, NoAccess } from "@/components/merchant/misc";
import { OfferForm } from "@/components/merchant/offer-form";
import { OfferPhaseBadge } from "@/components/merchant/status";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { roleAllows } from "@/modules/access/permissions";
import { getShopOffer, offerableListings } from "@/modules/offers/service";
import { guard, isUuid, loadShop, merchantCtx, requireMerchant, sp, type SearchParams } from "../../../_lib/data";
import { setOfferPublishedAction, updateOfferAction } from "../actions";

export const metadata: Metadata = { title: "Edit offer" };

const PHASE_TEXT = {
  draft: "Draft — not visible to customers until you publish it.",
  scheduled: "Published and scheduled — customers will see it from the start time.",
  active: "Active — customers see this discount now.",
  expired: "This offer has ended. Change the end date to run it again.",
  unpublished: "Unpublished — hidden from customers.",
} as const;

export default async function OfferPage({ params, searchParams }: { params: Promise<{ shopId: string; offerId: string }>; searchParams: SearchParams }) {
  const { shopId, offerId } = await params;
  const q = await searchParams;
  await requireMerchant(`/merchant/${shopId}/offers/${offerId}`);
  if (!isUuid(offerId)) notFound();
  const ctx = await merchantCtx();
  const { shop, role } = await loadShop(shopId);
  if (!roleAllows(role, "offer.manage")) return <NoAccess what="managing offers" />;
  const [offer, listings] = await Promise.all([guard(getShopOffer(ctx, offerId)), offerableListings(ctx, shopId)]);
  if (offer.shopId !== shopId) notFound();
  // Keep already-linked listings selectable even if they were archived since.
  const known = new Set(listings.map((l) => l.id));
  const missing = offer.listingIds.filter((id) => !known.has(id));
  const isPublished = offer.status === "published";
  const suspended = shop.status === "suspended";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={<BackLink href={`/merchant/${shopId}/offers`}>Offers</BackLink>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {offer.title} <OfferPhaseBadge phase={offer.phase} />
          </span>
        }
      />
      {sp(q.saved) && <Alert tone="success">Offer saved.</Alert>}
      {missing.length > 0 && (
        <Alert tone="warning">
          {missing.length} product{missing.length === 1 ? " in this offer is" : "s in this offer are"} no longer active and will be removed when you save.
        </Alert>
      )}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">{PHASE_TEXT[offer.phase]}</p>
        {!suspended &&
          (isPublished ? (
            <ConfirmAction
              action={setOfferPublishedAction.bind(null, offerId, false)}
              label="Unpublish"
              size="md"
              title="Unpublish this offer?"
              description="Customers will stop seeing the discount immediately. You can publish it again later."
              confirmLabel="Unpublish"
            />
          ) : (
            shop.status === "active" &&
            offer.phase !== "expired" && (
              <MerchantForm action={setOfferPublishedAction.bind(null, offerId, true)} className="gap-2" planHref={`/merchant/${shopId}/plan`}>
                <SubmitButton>Publish offer</SubmitButton>
              </MerchantForm>
            )
          ))}
      </Card>
      {suspended ? (
        <Alert tone="danger">This shop is suspended, so offers can&apos;t be edited.</Alert>
      ) : (
        <OfferForm
          action={updateOfferAction.bind(null, offerId)}
          listings={listings}
          shopName={shop.name}
          planHref={`/merchant/${shopId}/plan`}
          canPublish={false}
          isNew={false}
          initial={{
            title: offer.title,
            description: offer.description,
            conditions: offer.conditions,
            discountType: offer.discountType,
            discountValue: offer.discountValue,
            startsAt: offer.startsAt.toISOString(),
            endsAt: offer.endsAt.toISOString(),
            listingIds: offer.listingIds.filter((id) => known.has(id)),
          }}
        />
      )}
    </div>
  );
}
