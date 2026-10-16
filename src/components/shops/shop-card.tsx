import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Store } from "lucide-react";
import type { NearbyShop } from "@/modules/discovery/service";
import { formatDistance } from "@/modules/geo/format";
import { RatingSummary } from "@/components/products/rating";

export function ShopLogo({ src, name, size = 48 }: { src: string | null; name: string; size?: number }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2" style={{ width: size, height: size }}>
      {src ? (
        <Image src={src} alt={`${name} logo`} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted">
          <Store className="size-1/2" aria-hidden />
        </div>
      )}
    </div>
  );
}

export function ShopCard({ shop }: { shop: NearbyShop }) {
  const distance = formatDistance(shop.distanceM);
  return (
    <article className="relative flex items-center gap-3 rounded-xl border border-border bg-surface p-3 transition-shadow hover:shadow-md">
      <ShopLogo src={shop.logoUrl} name={shop.name} />
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-1 font-semibold">
          <Link href={`/s/${shop.slug}`} className="truncate after:absolute after:inset-0 hover:text-primary">
            {shop.name}
          </Link>
          {shop.isVerified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified shop" />}
        </h3>
        <p className="truncate text-sm text-muted">
          {[shop.categoryName, `${shop.productCount} product${shop.productCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm">
          <span className="inline-flex items-center gap-1 text-muted">
            <MapPin className="size-3.5" aria-hidden />
            {distance ? `${distance} · ${shop.city}` : shop.city}
          </span>
          <RatingSummary average={shop.rating} count={shop.reviewCount} className="text-xs" />
        </div>
      </div>
    </article>
  );
}
