import type { Metadata } from "next";
import { BackLink, NoAccess } from "@/components/merchant/misc";
import { OfferForm } from "@/components/merchant/offer-form";
import { Alert, PageHeader } from "@/components/ui/primitives";
import { roleAllows } from "@/modules/access/permissions";
import { offerableListings } from "@/modules/offers/service";
import { loadShop, merchantCtx, requireMerchant } from "../../../_lib/data";
import { createOfferAction } from "../actions";

export const metadata: Metadata = { title: "New offer" };

/** Starts now (to the minute), runs for a week. */
function defaultWindow() {
  const minute = 60_000;
  const start = new Date(Math.floor(Date.now() / minute) * minute);
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}

export default async function NewOfferPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  await requireMerchant(`/merchant/${shopId}/offers/new`);
  const ctx = await merchantCtx();
  const { shop, role } = await loadShop(shopId);
  const back = <BackLink href={`/merchant/${shopId}/offers`}>Offers</BackLink>;
  if (!roleAllows(role, "offer.manage")) return <NoAccess what="managing offers" />;
  if (shop.status === "suspended") {
    return (
      <>
        <PageHeader back={back} title="New offer" />
        <Alert tone="danger">This shop is suspended, so offers can&apos;t be created.</Alert>
      </>
    );
  }
  const listings = await offerableListings(ctx, shopId);
  const { start, end } = defaultWindow();

  return (
    <div>
      <PageHeader back={back} title="New offer" description="Discounts are applied to the price customers see while the offer is active." />
      {shop.status !== "active" && (
        <Alert tone="info" className="mb-4">
          Your shop isn&apos;t approved yet, so offers are saved as drafts. Publish them once your shop is live.
        </Alert>
      )}
      <OfferForm
        action={createOfferAction.bind(null, shopId)}
        listings={listings}
        shopName={shop.name}
        planHref={`/merchant/${shopId}/plan`}
        canPublish={shop.status === "active"}
        isNew
        initial={{
          title: "",
          description: null,
          conditions: null,
          discountType: "percent",
          discountValue: 0,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          listingIds: [],
        }}
      />
    </div>
  );
}
