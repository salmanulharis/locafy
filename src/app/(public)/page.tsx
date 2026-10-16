import Link from "next/link";
import { Heart, MapPin, Store } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { Rail, Section } from "@/components/layout/section";
import { LocationPicker } from "@/components/maps/location-picker";
import { ProductTile } from "@/components/products/product-card";
import { SearchBox } from "@/components/search/search-box";
import { CategoryGrid } from "@/components/shops/category-grid";
import { OfferCard } from "@/components/shops/offer-card";
import { ShopCard } from "@/components/shops/shop-card";
import { getSelectedLocation, toPoint } from "@/lib/location";
import { getCtx } from "@/modules/auth/context";
import { listCategories } from "@/modules/catalog/service";
import { nearbyProducts, nearbyShops, popularProducts } from "@/modules/discovery/service";
import { listFavourites } from "@/modules/favourites/service";
import { listActiveOffers } from "@/modules/offers/service";

export default async function HomePage() {
  const [ctx, location] = await Promise.all([getCtx(), getSelectedLocation()]);
  const point = toPoint(location);
  const radius = location?.radiusKm ?? 10;
  const [categories, products, popular, offers, shops, saved] = await Promise.all([
    listCategories({ scope: "shop" }).then((c) => c.filter((x) => !x.parentId)),
    nearbyProducts(point, radius, 10),
    popularProducts(point, radius, 10),
    listActiveOffers({ point, radiusKm: radius, limit: 8 }),
    nearbyShops(point, radius, { limit: 6 }),
    ctx.actor ? listFavourites(ctx) : null,
  ]);
  const savedProducts = saved?.products.slice(0, 8) ?? [];
  const area = location ? `near ${location.label.replace(/^Near /, "")}` : "on Locafy";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-6 sm:py-10">
      {/* Hero: light-blue highlight panel; full-bleed under the header on phones, rounded from sm up. */}
      <section className="-mx-4 -mt-6 flex flex-col gap-4 border-b border-border bg-primary-soft px-4 pt-7 pb-8 sm:mx-0 sm:mt-0 sm:items-center sm:rounded-2xl sm:border sm:px-8 sm:py-12 sm:text-center">
        <h1 className="text-display font-semibold tracking-tight text-balance">Find it in a shop near you</h1>
        <p className="max-w-xl text-fg sm:mx-auto">Search for a product, compare prices at local shops, check if it&apos;s in stock and get directions — before you travel.</p>
        <div className="w-full max-w-2xl sm:mx-auto [&_input]:shadow-sm">
          <SearchBox size="lg" />
        </div>
        {!location && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-fg sm:justify-center">
            <MapPin className="size-4" aria-hidden />
            Set your location to see what&apos;s nearby.
            <LocationPicker current={null} variant="button" />
          </div>
        )}
      </section>

      <Section title="Browse categories" href="/categories">
        <CategoryGrid categories={categories} limit={8} />
      </Section>

      {savedProducts.length > 0 && (
        <Section title="Your saved products" href="/saved">
          <Rail label="Saved products">
            {savedProducts.map((p) => (
              <Link key={p.id} href={`/p/${p.slug}`} role="listitem" className="flex w-40 shrink-0 flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-sm hover:shadow-md">
                <Heart className="size-4 fill-danger text-danger" aria-hidden />
                <span className="line-clamp-2 font-medium">{p.name}</span>
                <span className="text-xs text-muted">{p.sellerCount} shop{p.sellerCount === 1 ? "" : "s"}</span>
              </Link>
            ))}
          </Rail>
        </Section>
      )}

      <Section title={`In stock ${area}`} description="Recently updated by local shops" href="/search">
        {products.length ? (
          <Rail label="Products in stock nearby">
            {products.map((h) => (
              <div role="listitem" key={h.listingId}>
                <ProductTile hit={h} />
              </div>
            ))}
          </Rail>
        ) : (
          <Card>
            <EmptyState
              icon={<Store className="size-5" />}
              title={location ? "No products listed nearby yet" : "No products to show yet"}
              description={location ? "Try a larger search radius, or a different town." : "Shops are joining Locafy. Search for a product or set your location."}
            />
          </Card>
        )}
      </Section>

      {popular.length > 0 && (
        <Section title="Popular right now" description="Most viewed products in the last 30 days">
          <Rail label="Popular products">
            {popular.map((h) => (
              <div role="listitem" key={h.listingId}>
                <ProductTile hit={h} />
              </div>
            ))}
          </Rail>
        </Section>
      )}

      {offers.length > 0 && (
        <Section title={`Offers ${area}`} href="/offers">
          <Rail label="Local offers">
            {offers.map((o) => (
              <div role="listitem" key={o.id}>
                <OfferCard offer={o} />
              </div>
            ))}
          </Rail>
        </Section>
      )}

      <Section title={`Shops ${area}`} href="/shops">
        {shops.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((s) => (
              <ShopCard key={s.id} shop={s} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon={<Store className="size-5" />} title="No shops here yet" description="Know a great local shop? Invite them to list on Locafy." />
          </Card>
        )}
      </Section>

      <Card className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-heading font-semibold">Own a shop?</h2>
          <p className="text-sm text-muted">Create a free storefront, list products in minutes and get found by nearby customers.</p>
        </div>
        <LinkButton href="/merchant" variant="primary">
          List your shop
        </LinkButton>
      </Card>
    </div>
  );
}
