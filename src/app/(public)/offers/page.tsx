import type { Metadata } from "next";
import { Tag } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { OfferCard } from "@/components/shops/offer-card";
import { getSelectedLocation, toPoint } from "@/lib/location";
import { listActiveOffers } from "@/modules/offers/service";

export const metadata: Metadata = { title: "Local offers" };

export default async function OffersPage() {
  const location = await getSelectedLocation();
  const offers = await listActiveOffers({ point: toPoint(location), radiusKm: location?.radiusKm ?? 25, limit: 48 });
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader title="Local offers" description={location ? `Active offers near ${location.label.replace(/^Near /, "")}` : "Active offers from shops on Locafy"} />
      {offers.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 [&_article]:w-full">
          {offers.map((o) => (
            <li key={o.id} className="min-w-0">
              <OfferCard offer={o} />
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={<Tag className="size-5" />} title="No active offers nearby" description="Offers appear here while they are running. Try a larger radius or check back later." />
        </Card>
      )}
    </div>
  );
}
