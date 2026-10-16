import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronRight, Info, Store } from "lucide-react";
import { Alert, Card, EmptyState } from "@/components/ui/primitives";
import { ReportDialog } from "@/components/feedback/report-dialog";
import { ShopMap } from "@/components/maps/shop-map";
import { FavouriteButton } from "@/components/products/favourite-button";
import { ProductImage } from "@/components/products/product-image";
import { RatingSummary } from "@/components/products/rating";
import { ReviewSection } from "@/components/products/review-section";
import { SellerList } from "@/components/products/seller-list";
import { ShareButton } from "@/components/shops/contact-actions";
import { getSelectedLocation, toPoint } from "@/lib/location";
import { formatMoney } from "@/lib/money";
import { getCtx } from "@/modules/auth/context";
import { isSaved } from "@/modules/favourites/service";
import { getProductDetail } from "@/modules/products/service";
import { myReviewFor } from "@/modules/reviews/service";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const ctx = await getCtx();
  const d = await getProductDetail(ctx, slug, null, { track: false });
  if (!d || "redirectTo" in d) return { title: "Product" };
  const title = [d.product.brand && !d.product.name.startsWith(d.product.brand) ? d.product.brand : null, d.product.name, d.product.variant].filter(Boolean).join(" ");
  return { title, description: d.product.description?.slice(0, 160) ?? `Compare prices for ${title} at shops near you.` };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [ctx, location] = await Promise.all([getCtx(), getSelectedLocation()]);
  const d = await getProductDetail(ctx, slug, toPoint(location));
  if (!d) notFound();
  if ("redirectTo" in d) permanentRedirect(`/p/${d.redirectTo}`);
  const { product, sellers, images, variants, rating, reviews } = d;
  const [saved, myReview] = await Promise.all([isSaved(ctx, "product", product.id), myReviewFor(ctx, "product", product.id)]);
  const available = sellers.filter((s) => s.stockStatus !== "out_of_stock");
  const cheapest = available.length ? Math.min(...available.map((s) => s.effectivePriceMinor)) : null;
  const specs = Object.entries(product.specs ?? {});
  const path = `/p/${product.slug}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/search" className="hover:text-fg">
          Search
        </Link>
        {product.category && (
          <>
            <ChevronRight className="size-3.5" aria-hidden />
            <Link href={`/search?category=${product.categorySlug}`} className="hover:text-fg">
              {product.category}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <div className="flex flex-col gap-3">
          <ProductImage src={images[0]?.url} alt={images[0]?.alt ?? product.name} className="aspect-[4/3] w-full rounded-xl border border-border sm:aspect-square" sizes="(min-width:1024px) 480px, 100vw" priority />
          {images.length > 1 && (
            <ul className="scrollbar-none flex gap-2 overflow-x-auto" aria-label="More photos">
              {images.slice(1).map((img, i) => (
                <li key={img.url}>
                  <ProductImage src={img.url} alt={img.alt ?? `${product.name} photo ${i + 2}`} className="size-20 rounded-lg border border-border" sizes="80px" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2">
            {product.brand && <p className="text-sm font-medium text-muted">{product.brand}</p>}
            <h1 className="text-title font-semibold tracking-tight text-balance">{product.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {product.model && <span>Model: {product.model}</span>}
              {product.variant && <span>Variant: {product.variant}</span>}
              <RatingSummary average={rating.average} count={rating.count} />
            </div>
            {cheapest != null && (
              <p className="text-sm">
                <span className="text-muted">From </span>
                <span className="text-price font-semibold tabular">{formatMoney(cheapest)}</span>
                <span className="text-muted">
                  {" "}
                  at {available.length} shop{available.length === 1 ? "" : "s"}
                  {location ? " near you" : ""}
                </span>
              </p>
            )}
            <div className="mt-1 flex flex-wrap gap-2">
              <FavouriteButton kind="product" id={product.id} saved={saved} signedIn={Boolean(ctx.actor)} label={product.name} />
              <ShareButton title={product.name} />
            </div>
          </div>

          {variants.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Other variants</h2>
              <ul className="flex flex-wrap gap-2">
                <li>
                  <span aria-current="true" className="inline-flex min-h-10 items-center rounded-lg border-2 border-primary px-3 text-sm font-medium">
                    {product.variant ?? "This variant"}
                  </span>
                </li>
                {variants.map((v) => (
                  <li key={v.slug}>
                    <Link href={`/p/${v.slug}`} className="inline-flex min-h-10 items-center rounded-lg border border-border-strong px-3 text-sm hover:bg-surface-2">
                      {v.variant ?? v.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-muted">Each variant has its own prices and stock.</p>
            </div>
          )}

          <section aria-labelledby="sellers-heading" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="sellers-heading" className="text-heading font-semibold">
                Where to buy{location ? ` near ${location.label.replace(/^Near /, "")}` : ""}
              </h2>
              <span className="text-sm text-muted">{sellers.length} shop{sellers.length === 1 ? "" : "s"}</span>
            </div>
            {sellers.length ? (
              <>
                <SellerList sellers={sellers} productName={[product.name, product.variant].filter(Boolean).join(" ")} signedIn={Boolean(ctx.actor)} nextPath={path} cheapest={cheapest} />
                <p className="flex items-start gap-1.5 text-xs text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Prices and stock are updated by each shop and are not live. Call or message the shop to confirm before you travel.
                </p>
              </>
            ) : (
              <Card>
                <EmptyState icon={<Store className="size-5" />} title="No shop currently lists this product" description="Save it and check back later, or ask a local shop." />
              </Card>
            )}
          </section>

          {sellers.length > 0 && (
            <ShopMap
              className="h-64"
              center={location ? { lat: location.lat, lng: location.lng } : null}
              markers={sellers.map((s) => ({ id: s.listingId, lat: s.lat, lng: s.lng, title: s.shopName, subtitle: formatMoney(s.effectivePriceMinor, s.currency), href: `/s/${s.shopSlug}` }))}
              label="Map of shops selling this product"
            />
          )}

          {(product.description || specs.length > 0) && (
            <section aria-labelledby="details-heading" className="flex flex-col gap-3">
              <h2 id="details-heading" className="text-heading font-semibold">
                Product details
              </h2>
              {product.description && <p className="text-sm leading-relaxed whitespace-pre-line">{product.description}</p>}
              {specs.length > 0 && (
                <dl className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border bg-surface text-sm sm:grid-cols-2 sm:divide-y-0">
                  {specs.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 px-4 py-2.5 sm:border-b sm:border-border">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          )}

          {product.gtin && <p className="text-xs text-muted">Barcode: {product.gtin}</p>}

          <ReviewSection
            targetType="product"
            targetId={product.id}
            average={rating.average}
            count={rating.count}
            items={reviews}
            viewerId={ctx.actor?.id ?? null}
            myReview={myReview}
            canReview
            nextPath={path}
          />

          <div className="border-t border-border pt-3">
            <ReportDialog targetType="product" targetId={product.id} signedIn={Boolean(ctx.actor)} />
          </div>
          {!ctx.actor && <Alert tone="info">Sign in to save this product, ask shops about availability, or leave a review.</Alert>}
        </div>
      </div>
    </div>
  );
}
