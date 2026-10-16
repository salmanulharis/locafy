import Link from "next/link";
import { BadgeCheck, MapPin, Tag } from "lucide-react";
import type { SearchHit } from "@/modules/search/service";
import { formatDistance } from "@/modules/geo/format";
import { Badge } from "@/components/ui/primitives";
import { Availability } from "./availability";
import { Price } from "./price";
import { ProductImage } from "./product-image";
import { cn } from "@/lib/cn";

function specLine(specs: Record<string, string>) {
  return Object.entries(specs)
    .slice(0, 3)
    .map(([, v]) => v)
    .join(" · ");
}

/**
 * Search result row: one product at one shop. Horizontal on all sizes so the
 * product, price, availability and distance are scannable on small screens.
 */
export function ProductResultCard({ hit, sponsored, className }: { hit: SearchHit; sponsored?: boolean; className?: string }) {
  const distance = formatDistance(hit.distanceM);
  const specs = specLine(hit.specs);
  return (
    <article className={cn("relative flex gap-3 rounded-xl border border-border bg-surface p-3 transition-shadow hover:shadow-md sm:gap-4 sm:p-4", className)}>
      <ProductImage src={hit.imageUrl} alt={hit.name} className="size-24 shrink-0 rounded-lg sm:size-28" sizes="112px" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {sponsored && <Badge tone="neutral">Sponsored</Badge>}
          {hit.offerTitle && (
            <Badge tone="deal" icon={<Tag className="size-3" aria-hidden />}>
              Offer
            </Badge>
          )}
        </div>
        <h3 className="text-[0.9375rem] leading-snug font-semibold">
          <Link href={`/p/${hit.productSlug}`} className="after:absolute after:inset-0 hover:text-primary">
            {hit.name}
          </Link>
        </h3>
        {(hit.variant || specs) && <p className="line-clamp-1 text-sm text-muted">{[hit.variant, specs].filter(Boolean).join(" · ")}</p>}
        <Price effective={hit.effectivePriceMinor} base={hit.offerPriceMinor ? hit.priceMinor : null} mrp={hit.mrpMinor} currency={hit.currency} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1 font-medium">
            <span className="truncate">{hit.shopName}</span>
            {hit.shopVerified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified shop" />}
          </span>
          <span className="inline-flex items-center gap-1 text-muted">
            <MapPin className="size-3.5" aria-hidden />
            {distance ? `${distance} · ${hit.city}` : hit.city}
          </span>
        </div>
        <Availability status={hit.stockStatus} updatedAt={hit.stockUpdatedAt} compact />
      </div>
    </article>
  );
}

/** Compact vertical card for home-page carousels. */
export function ProductTile({ hit }: { hit: SearchHit }) {
  const distance = formatDistance(hit.distanceM);
  return (
    <article className="relative flex w-40 shrink-0 flex-col gap-2 sm:w-48">
      <ProductImage src={hit.imageUrl} alt={hit.name} className="aspect-square w-full rounded-xl border border-border" sizes="192px" />
      <div className="flex flex-col gap-0.5">
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <Link href={`/p/${hit.productSlug}`} className="after:absolute after:inset-0 hover:text-primary">
            {hit.name}
            {hit.variant ? ` (${hit.variant})` : ""}
          </Link>
        </h3>
        <Price effective={hit.effectivePriceMinor} base={hit.offerPriceMinor ? hit.priceMinor : null} currency={hit.currency} size="sm" />
        <p className="truncate text-xs text-muted">
          {hit.shopName}
          {distance ? ` · ${distance}` : ""}
        </p>
      </div>
    </article>
  );
}
