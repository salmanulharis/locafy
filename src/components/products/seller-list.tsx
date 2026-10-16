import Link from "next/link";
import { BadgeCheck, MapPin, Tag } from "lucide-react";
import type { SellerOffer } from "@/modules/products/service";
import { formatDistance } from "@/modules/geo/format";
import { ContactActions } from "@/components/shops/contact-actions";
import { EnquiryDialog } from "@/components/shops/enquiry-dialog";
import { Availability } from "./availability";
import { Price } from "./price";
import { RatingSummary } from "./rating";

/**
 * Seller comparison for ONE catalogue product (same brand/model/variant).
 * Rows are flat (no nested cards) so price, stock and distance scan quickly.
 */
export function SellerList({ sellers, productName, signedIn, nextPath, cheapest }: { sellers: SellerOffer[]; productName: string; signedIn: boolean; nextPath: string; cheapest: number | null }) {
  return (
    <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
      {sellers.map((s) => {
        const distance = formatDistance(s.distanceM);
        const isCheapest = cheapest != null && s.effectivePriceMinor === cheapest && s.stockStatus !== "out_of_stock" && sellers.length > 1;
        return (
          <li key={s.listingId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={`/s/${s.shopSlug}`} className="font-semibold hover:text-primary">
                  {s.shopName}
                </Link>
                {s.shopVerified && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
                    <BadgeCheck className="size-4" aria-hidden /> Verified
                  </span>
                )}
                <RatingSummary average={s.shopRating} count={s.shopReviewCount} className="text-xs" />
              </div>
              <p className="inline-flex items-center gap-1 text-sm text-muted">
                <MapPin className="size-3.5" aria-hidden />
                {[distance, s.branchName !== "Main store" ? s.branchName : null, s.city].filter(Boolean).join(" · ")}
              </p>
              <Availability status={s.stockStatus} updatedAt={s.stockUpdatedAt} compact />
              {s.offerTitle && (
                <p className="inline-flex items-center gap-1 text-sm text-accent-soft-fg">
                  <Tag className="size-3.5" aria-hidden /> {s.offerTitle}
                </p>
              )}
              {s.notes && <p className="text-sm text-muted">{s.notes}</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5">
                <Price effective={s.effectivePriceMinor} base={s.offerId ? s.priceMinor : null} mrp={s.mrpMinor} currency={s.currency} />
                {isCheapest && <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-xs font-medium text-success-soft-fg">Lowest price</span>}
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <ContactActions shopId={s.shopId} listingId={s.listingId} phone={s.phone} whatsapp={s.whatsapp} lat={s.lat} lng={s.lng} shopName={s.shopName} productName={productName} compact />
                <EnquiryDialog shopId={s.shopId} shopName={s.shopName} listingId={s.listingId} productName={productName} signedIn={signedIn} nextPath={nextPath} size="sm" />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
