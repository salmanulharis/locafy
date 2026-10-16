import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BadgeCheck, Globe, Mail, MapPin, Package } from "lucide-react";
import { Alert, Card, EmptyState } from "@/components/ui/primitives";
import { Rail, Section } from "@/components/layout/section";
import { ReportDialog } from "@/components/feedback/report-dialog";
import { ShopMap } from "@/components/maps/shop-map";
import { FavouriteButton } from "@/components/products/favourite-button";
import { ProductResultCard } from "@/components/products/product-card";
import { RatingSummary } from "@/components/products/rating";
import { ReviewSection } from "@/components/products/review-section";
import { ContactActions, ShareButton } from "@/components/shops/contact-actions";
import { EnquiryDialog } from "@/components/shops/enquiry-dialog";
import { OfferCard } from "@/components/shops/offer-card";
import { OpeningHoursTable } from "@/components/shops/opening-hours";
import { ShopLogo } from "@/components/shops/shop-card";
import { getSelectedLocation, toPoint } from "@/lib/location";
import { getCtx } from "@/modules/auth/context";
import { recordShopView, shopCatalogue } from "@/modules/discovery/service";
import { isSaved } from "@/modules/favourites/service";
import { formatDistance, haversineMetres } from "@/modules/geo/format";
import { listActiveOffers } from "@/modules/offers/service";
import { listShopReviews, myReviewFor } from "@/modules/reviews/service";
import { getPublicShopBySlug, isShopMember } from "@/modules/shops/service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getPublicShopBySlug(await getCtx(), slug);
  if (!shop) return { title: "Shop" };
  const city = shop.branches[0]?.city;
  return { title: city ? `${shop.name}, ${city}` : shop.name, description: shop.description?.slice(0, 160) ?? undefined };
}

const STATUS_NOTE: Record<string, string> = {
  draft: "This shop is a draft and is not visible to customers yet.",
  pending: "This shop is awaiting approval and is not visible to customers yet.",
  rejected: "This shop needs changes before it can be approved. Customers cannot see it.",
  suspended: "This shop is suspended and hidden from customers.",
};

export default async function ShopPage({ params }: Props) {
  const { slug } = await params;
  const [ctx, location] = await Promise.all([getCtx(), getSelectedLocation()]);
  const shop = await getPublicShopBySlug(ctx, slug);
  if (!shop) notFound();
  const point = toPoint(location);
  const [catalogue, offers, reviews, saved, myReview, isMember] = await Promise.all([
    shopCatalogue(shop.id, point),
    listActiveOffers({ shopId: shop.id, limit: 10 }),
    listShopReviews(ctx, shop.id),
    isSaved(ctx, "shop", shop.id),
    myReviewFor(ctx, "shop", shop.id),
    isShopMember(ctx, shop.id),
  ]);
  if (shop.status === "active") await recordShopView(ctx, shop.id);
  const primary = shop.branches[0];
  const distance = primary?.lat != null && point ? formatDistance(haversineMetres(point, { lat: primary.lat, lng: primary.lng! })) : null;
  const path = `/s/${shop.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      {shop.status !== "active" && (
        <Alert tone="warning" className="mb-4" title="Preview">
          {STATUS_NOTE[shop.status]}
        </Alert>
      )}

      {shop.coverUrl && (
        <div className="relative mb-4 aspect-[3/1] w-full overflow-hidden rounded-xl border border-border bg-surface-2 sm:aspect-[4/1]">
          <Image src={shop.coverUrl} alt="" fill sizes="(min-width:1152px) 1152px, 100vw" className="object-cover" priority />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <header className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <ShopLogo src={shop.logoUrl} name={shop.name} size={64} />
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-2 text-title font-semibold tracking-tight">
                  {shop.name}
                  {shop.isVerified && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-fg">
                      <BadgeCheck className="size-3.5" aria-hidden /> Verified business
                    </span>
                  )}
                </h1>
                <p className="mt-0.5 text-sm text-muted">{[shop.categoryName, distance ? `${distance} away` : null].filter(Boolean).join(" · ")}</p>
                <RatingSummary average={reviews.average} count={reviews.count} className="mt-1" />
              </div>
            </div>
            {shop.description && <p className="text-sm leading-relaxed whitespace-pre-line text-fg">{shop.description}</p>}
            <div className="flex flex-wrap gap-2">
              <ContactActions shopId={shop.id} phone={shop.phone} whatsapp={shop.whatsapp} lat={primary?.lat ?? null} lng={primary?.lng ?? null} shopName={shop.name} />
              {!isMember && shop.status === "active" && <EnquiryDialog shopId={shop.id} shopName={shop.name} signedIn={Boolean(ctx.actor)} nextPath={path} />}
              <FavouriteButton kind="shop" id={shop.id} saved={saved} signedIn={Boolean(ctx.actor)} label={shop.name} />
              <ShareButton title={shop.name} />
            </div>
          </header>

          {offers.length > 0 && (
            <Section title="Current offers">
              <Rail label="Offers from this shop">
                {offers.map((o) => (
                  <div role="listitem" key={o.id}>
                    <OfferCard offer={o} />
                  </div>
                ))}
              </Rail>
            </Section>
          )}

          <Section title={`Products (${catalogue.length})`}>
            {catalogue.length ? (
              <ul className="flex flex-col gap-3">
                {catalogue.map((h) => (
                  <li key={h.listingId}>
                    <ProductResultCard hit={h} />
                  </li>
                ))}
              </ul>
            ) : (
              <Card>
                <EmptyState icon={<Package className="size-5" />} title="No products listed yet" description="Contact the shop to ask what they stock." />
              </Card>
            )}
          </Section>

          <ReviewSection
            targetType="shop"
            targetId={shop.id}
            average={reviews.average}
            count={reviews.count}
            items={reviews.items}
            viewerId={ctx.actor?.id ?? null}
            myReview={myReview}
            canReview={!isMember && shop.status === "active"}
            nextPath={path}
            shopName={shop.name}
          />
        </div>

        <aside className="flex flex-col gap-4" aria-label="Shop information">
          {primary && (
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="text-heading font-semibold">Address</h2>
              <p className="flex gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <span>{[primary.addressLine, primary.locality, primary.city, primary.postalCode].filter(Boolean).join(", ")}</span>
              </p>
              {primary.lat != null && primary.lng != null ? (
                <ShopMap className="h-48" markers={[{ id: primary.id, lat: primary.lat, lng: primary.lng, title: shop.name, subtitle: primary.addressLine }]} label={`Map showing ${shop.name}`} />
              ) : (
                <p className="text-sm text-muted">Map location not available.</p>
              )}
              {shop.branches.length > 1 && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">Other branches ({shop.branches.length - 1})</summary>
                  <ul className="mt-2 flex flex-col gap-2">
                    {shop.branches.slice(1).map((b) => (
                      <li key={b.id}>
                        <span className="font-medium">{b.name}</span>
                        <br />
                        <span className="text-muted">{[b.addressLine, b.city].join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          )}
          <Card className="flex flex-col gap-3 p-4">
            <h2 className="text-heading font-semibold">Opening hours</h2>
            <OpeningHoursTable hours={primary?.openingHours} />
          </Card>
          {(shop.email || shop.website) && (
            <Card className="flex flex-col gap-2 p-4 text-sm">
              {shop.website && (
                <a href={shop.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-2 text-primary hover:underline">
                  <Globe className="size-4" aria-hidden /> Website
                </a>
              )}
              {shop.email && (
                <a href={`mailto:${shop.email}`} className="inline-flex min-h-11 items-center gap-2 text-primary hover:underline">
                  <Mail className="size-4" aria-hidden /> {shop.email}
                </a>
              )}
            </Card>
          )}
          <ReportDialog targetType="shop" targetId={shop.id} label="Report this shop" signedIn={Boolean(ctx.actor)} />
        </aside>
      </div>
    </div>
  );
}
