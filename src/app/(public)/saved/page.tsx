import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, Store } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { FavouriteButton } from "@/components/products/favourite-button";
import { ProductImage } from "@/components/products/product-image";
import { ShopLogo } from "@/components/shops/shop-card";
import { formatMoney } from "@/lib/money";
import { getCtx } from "@/modules/auth/context";
import { listFavourites } from "@/modules/favourites/service";

export const metadata: Metadata = { title: "Saved" };

export default async function SavedPage() {
  const ctx = await getCtx();
  if (!ctx.actor) redirect("/login?next=/saved");
  const { products, shops, hiddenShops } = await listFavourites(ctx);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-6">
      <PageHeader title="Saved" description="Products and shops you've saved. Prices shown are the lowest currently listed." />
      <section aria-labelledby="saved-products" className="flex flex-col gap-3">
        <h2 id="saved-products" className="text-heading font-semibold">
          Products ({products.length})
        </h2>
        {products.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3">
                <ProductImage src={p.imageUrl} alt={p.name} className="size-16 shrink-0 rounded-lg" sizes="64px" />
                <div className="min-w-0 flex-1">
                  <Link href={`/p/${p.slug}`} className="line-clamp-2 font-medium hover:text-primary">
                    {p.name}
                    {p.variant ? ` (${p.variant})` : ""}
                  </Link>
                  <p className="text-sm text-muted">
                    {p.sellerCount
                      ? `${p.sellerCount} shop${p.sellerCount === 1 ? "" : "s"}${p.minPrice ? ` · from ${formatMoney(p.minPrice)}` : ""}`
                      : "No shop currently lists this"}
                  </p>
                </div>
                <FavouriteButton kind="product" id={p.id} saved signedIn label={p.name} />
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <EmptyState
              icon={<Heart className="size-5" />}
              title="No saved products"
              description="Tap Save on a product to keep track of it."
              action={
                <LinkButton href="/search" size="sm">
                  Find products
                </LinkButton>
              }
            />
          </Card>
        )}
      </section>
      <section aria-labelledby="saved-shops" className="flex flex-col gap-3">
        <h2 id="saved-shops" className="text-heading font-semibold">
          Shops ({shops.length})
        </h2>
        {shops.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {shops.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <ShopLogo src={s.logoUrl} name={s.name} />
                <Link href={`/s/${s.slug}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">
                  {s.name}
                </Link>
                <FavouriteButton kind="shop" id={s.id} saved signedIn label={s.name} />
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <EmptyState icon={<Store className="size-5" />} title="No saved shops" />
          </Card>
        )}
        {hiddenShops > 0 && (
          <p className="text-sm text-muted">
            {hiddenShops} saved shop{hiddenShops === 1 ? " is" : "s are"} currently unavailable on Locafy.
          </p>
        )}
      </section>
    </div>
  );
}
