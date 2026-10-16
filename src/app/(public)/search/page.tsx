import type { Metadata } from "next";
import Link from "next/link";
import { List, Map as MapIcon, SearchX } from "lucide-react";
import { Alert, Card, EmptyState } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/pagination";
import { LocationPicker } from "@/components/maps/location-picker";
import { ShopMap } from "@/components/maps/shop-map";
import { ProductResultCard } from "@/components/products/product-card";
import { FilterSheet } from "@/components/search/filter-sheet";
import { FiltersForm, type FilterValues } from "@/components/search/filters-form";
import { SearchBox } from "@/components/search/search-box";
import { AutoSubmitSelect } from "@/components/search/auto-submit-select";
import { getSelectedLocation } from "@/lib/location";
import { isAppError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { getCtx } from "@/modules/auth/context";
import { listCategories } from "@/modules/catalog/service";
import { formatMoney } from "@/lib/money";
import { searchProducts, type SearchResult } from "@/modules/search/service";

type SP = FilterValues & { page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `“${q}” near you` : "Search products", robots: { index: false } };
}

const SORTS = [
  ["relevance", "Best match"],
  ["price", "Lowest price"],
  ["distance", "Nearest"],
  ["rating", "Best-rated shop"],
] as const;

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [ctx, location, categories] = await Promise.all([getCtx(), getSelectedLocation(), listCategories({ scope: "product" })]);
  const radiusKm = sp.radiusKm ? Number(sp.radiusKm) : (location?.radiusKm ?? undefined);
  const view = sp.view === "map" ? "map" : "list";

  let result: SearchResult | null = null;
  let error: string | null = null;
  try {
    result = await searchProducts(ctx, {
      q: sp.q,
      category: sp.category || undefined,
      minPrice: sp.minPrice || undefined,
      maxPrice: sp.maxPrice || undefined,
      availability: sp.availability === "in_stock" ? "in_stock" : "any",
      offers: sp.offers === "true" ? true : undefined,
      minRating: sp.minRating || undefined,
      sort: sp.sort,
      page: sp.page,
      lat: location?.lat,
      lng: location?.lng,
      radiusKm,
    });
  } catch (e) {
    error = isAppError(e) ? e.message : "Search is temporarily unavailable. Please try again.";
  }

  const category = categories.find((c) => c.slug === sp.category);
  const activeFilters = [sp.category, sp.minPrice, sp.maxPrice, sp.availability === "in_stock" ? "1" : "", sp.offers, sp.minRating, sp.radiusKm].filter(Boolean).length;
  const heading = sp.q ? `Results for “${sp.q}”` : category ? category.name : "All products";
  const baseParams = { ...sp } as Record<string, string | undefined>;
  const linkWith = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...baseParams, ...patch, page: undefined })) if (v) p.set(k, v);
    return `/search?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <div className="mb-4 md:hidden">
        <SearchBox defaultValue={sp.q ?? ""} />
      </div>

      <div className="grid gap-6 md:grid-cols-[15rem_1fr] lg:grid-cols-[16rem_1fr]">
        <aside className="hidden md:block" aria-label="Filters">
          <div className="sticky top-20">
            <h2 className="mb-3 text-heading font-semibold">Filters</h2>
            <FiltersForm values={sp} categories={categories} hasLocation={Boolean(location)} idPrefix="side" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <h1 className="text-title font-semibold tracking-tight text-balance">{heading}</h1>
              {result && (
                <p className="text-sm text-muted" aria-live="polite">
                  {result.total} result{result.total === 1 ? "" : "s"}
                  {result.hasLocation && location ? ` within ${result.radiusKm} km of ${location.label.replace(/^Near /, "")}` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="md:hidden">
                <FilterSheet activeCount={activeFilters}>
                  <FiltersForm values={sp} categories={categories} hasLocation={Boolean(location)} idPrefix="sheet" />
                </FilterSheet>
              </div>
              <form action="/search" className="flex items-center gap-2">
                {Object.entries(sp).map(([k, v]) => (k !== "sort" && k !== "page" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
                <label htmlFor="sort" className="sr-only">
                  Sort by
                </label>
                <AutoSubmitSelect id="sort" name="sort" defaultValue={sp.sort ?? "relevance"} className="h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm">
                  {SORTS.map(([v, l]) => (
                    <option key={v} value={v} disabled={v === "distance" && !location}>
                      {l}
                      {v === "distance" && !location ? " (set location)" : ""}
                    </option>
                  ))}
                </AutoSubmitSelect>
                <noscript>
                  <button type="submit" className="h-11 rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-surface-2">
                    Sort
                  </button>
                </noscript>
              </form>
              <div className="ml-auto flex rounded-lg border border-border-strong p-0.5" role="group" aria-label="View">
                <Link href={linkWith({ view: undefined })} aria-current={view === "list" ? "page" : undefined} className={cn("inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium", view === "list" ? "bg-surface-2" : "text-muted")}>
                  <List className="size-4" aria-hidden /> List
                </Link>
                <Link href={linkWith({ view: "map" })} aria-current={view === "map" ? "page" : undefined} className={cn("inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium", view === "map" ? "bg-surface-2" : "text-muted")}>
                  <MapIcon className="size-4" aria-hidden /> Map
                </Link>
              </div>
            </div>
          </div>

          {!location && (
            <Alert tone="info" action={<LocationPicker current={null} variant="button" />}>
              Set your location to see distances and nearby shops first.
            </Alert>
          )}

          {error && <Alert tone="danger" title="Search failed">{error}</Alert>}

          {result && result.matchMode === "fuzzy" && result.total > 0 && (
            <Alert tone="info">No exact matches — showing products with a similar spelling.</Alert>
          )}
          {result && result.matchMode === "partial" && result.total > 0 && (
            <Alert tone="info">No product matched every word — showing results that match some of your words.</Alert>
          )}

          {result && result.total === 0 && (
            <Card>
              <EmptyState
                icon={<SearchX className="size-5" />}
                title={result.existsOutsideRadius ? "Not available within your search radius" : sp.q ? "No shops list this product yet" : "No products found"}
                description={
                  result.existsOutsideRadius
                    ? "Shops further away list this product. Try increasing the distance."
                    : "Check the spelling, try a more general term, or remove some filters."
                }
                action={
                  result.existsOutsideRadius ? (
                    <Link href={linkWith({ radiusKm: "50" })} className="text-sm font-medium text-primary hover:underline">
                      Search within 50 km
                    </Link>
                  ) : undefined
                }
              />
            </Card>
          )}

          {result && result.alternatives.length > 0 && (
            <section aria-labelledby="alt-heading" className="flex flex-col gap-3">
              <h2 id="alt-heading" className="text-heading font-semibold">
                Similar products nearby
              </h2>
              <p className="-mt-2 text-sm text-muted">These are not exact matches for your search.</p>
              <ul className="flex flex-col gap-3">
                {result.alternatives.map((h) => (
                  <li key={h.listingId}>
                    <ProductResultCard hit={h} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result && result.total > 0 && view === "map" && (
            <ShopMap
              className="h-[60dvh] min-h-80"
              center={location ? { lat: location.lat, lng: location.lng } : null}
              markers={result.items.map((h) => ({
                id: h.listingId,
                lat: h.lat,
                lng: h.lng,
                title: h.shopName,
                subtitle: `${h.name} · ${formatMoney(h.effectivePriceMinor, h.currency)}`,
                href: `/p/${h.productSlug}`,
              }))}
              label="Map of shops with matching products"
            />
          )}

          {result && result.total > 0 && (
            <ul className="flex flex-col gap-3">
              {result.sponsored && (
                <li>
                  <ProductResultCard hit={result.sponsored} sponsored />
                </li>
              )}
              {result.items.map((h) => (
                <li key={h.listingId}>
                  <ProductResultCard hit={h} />
                </li>
              ))}
            </ul>
          )}

          {result && <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath="/search" params={baseParams} />}
        </div>
      </div>
    </div>
  );
}
