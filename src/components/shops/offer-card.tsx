import Link from "next/link";
import { CalendarClock, Tag } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { formatDistance } from "@/modules/geo/format";
import { describeOffer, type DiscountType } from "@/modules/offers/rules";

export type OfferCardData = {
  id: string;
  title: string;
  description: string | null;
  conditions: string | null;
  discountType: DiscountType;
  discountValue: number;
  endsAt: Date;
  shopSlug: string;
  shopName: string;
  distanceM: number | null;
  products: { slug: string; name: string; variant: string | null }[];
};

function endsLabel(endsAt: Date) {
  const days = Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000);
  if (days <= 1) return "Ends today";
  return `Ends in ${days} days`;
}

export function OfferCard({ offer }: { offer: OfferCardData }) {
  const distance = formatDistance(offer.distanceM);
  return (
    <article className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:w-80">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2 py-0.5 text-sm font-semibold text-accent-fg">
          <Tag className="size-3.5" aria-hidden />
          {describeOffer(offer.discountType, offer.discountValue, (m) => formatMoney(m))}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <CalendarClock className="size-3.5" aria-hidden />
          {endsLabel(offer.endsAt)}
        </span>
      </div>
      <h3 className="font-semibold leading-snug">{offer.title}</h3>
      <p className="text-sm text-muted">
        <Link href={`/s/${offer.shopSlug}`} className="font-medium text-fg hover:text-primary">
          {offer.shopName}
        </Link>
        {distance ? ` · ${distance}` : ""}
      </p>
      {offer.products.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm">
          {offer.products.slice(0, 3).map((p) => (
            <li key={p.slug} className="truncate">
              <Link href={`/p/${p.slug}`} className="text-primary hover:underline">
                {p.name}
                {p.variant ? ` (${p.variant})` : ""}
              </Link>
            </li>
          ))}
          {offer.products.length > 3 && <li className="text-muted">+{offer.products.length - 3} more</li>}
        </ul>
      )}
      {offer.conditions && <p className="line-clamp-2 text-xs text-muted">{offer.conditions}</p>}
    </article>
  );
}
