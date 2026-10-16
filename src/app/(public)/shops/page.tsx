import type { Metadata } from "next";
import { Search, Store } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { Input, Select } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { ShopMap } from "@/components/maps/shop-map";
import { ShopCard } from "@/components/shops/shop-card";
import { getSelectedLocation, toPoint } from "@/lib/location";
import { listCategories } from "@/modules/catalog/service";
import { nearbyShops } from "@/modules/discovery/service";

export const metadata: Metadata = { title: "Shops near you" };

export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const { q, category } = await searchParams;
  const location = await getSelectedLocation();
  const [shops, categories] = await Promise.all([
    nearbyShops(toPoint(location), location?.radiusKm ?? 25, { limit: 60, q: q?.trim() || undefined, category: category || undefined }),
    listCategories({ scope: "shop" }).then((c) => c.filter((x) => !x.parentId)),
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <PageHeader title="Shops" description={location ? `Within ${location.radiusKm} km of ${location.label.replace(/^Near /, "")}` : "Set your location to see the nearest shops first."} />
      <form action="/shops" className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor="shop-q" className="sr-only">Shop name</label>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input id="shop-q" name="q" type="search" defaultValue={q} placeholder="Search shops by name" className="pl-9" />
        </div>
        <label htmlFor="shop-cat" className="sr-only">Category</label>
        <Select id="shop-cat" name="category" defaultValue={category ?? ""} className="sm:w-56">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </Select>
        <button type="submit" className={buttonClass("primary", "md")}>Search</button>
      </form>
      {shops.length ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <ul className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {shops.map((s) => <li key={s.id}><ShopCard shop={s} /></li>)}
          </ul>
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <ShopMap
                className="h-[70dvh]"
                center={location ? { lat: location.lat, lng: location.lng } : null}
                markers={shops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, title: s.name, subtitle: s.city, href: `/s/${s.slug}` }))}
                label="Map of shops"
              />
            </div>
          </div>
        </div>
      ) : (
        <Card><EmptyState icon={<Store className="size-5" />} title="No shops found" description="Try another name, category or a larger radius." /></Card>
      )}
    </div>
  );
}
