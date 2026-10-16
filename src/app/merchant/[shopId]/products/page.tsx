import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ProductImage } from "@/components/products/product-image";
import { relativeTime } from "@/components/products/availability";
import { Pagination, productTitle } from "@/components/merchant/misc";
import { ListingStatusBadge, StaleBadge, StockBadge } from "@/components/merchant/status";
import { formatMoney } from "@/lib/money";
import { roleAllows } from "@/modules/access/permissions";
import { STALE_AFTER_DAYS, stockFreshness, type StockStatus } from "@/modules/inventory/rules";
import type { ListingStatus } from "@/modules/listings/rules";
import { listMerchantListings } from "@/modules/listings/service";
import { guard, loadShop, merchantCtx, requireMerchant, sp, type SearchParams } from "../../_lib/data";

export const metadata: Metadata = { title: "Products" };

const STATUS_OPTIONS = [
  { value: "", label: "All current" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "unpublished", label: "Unpublished" },
  { value: "discontinued", label: "Discontinued" },
  { value: "restricted", label: "Restricted" },
  { value: "archived", label: "Archived" },
];
const STOCK_OPTIONS = [
  { value: "", label: "Any stock" },
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "unknown", label: "Not confirmed" },
  { value: "stale", label: `Needs update (${STALE_AFTER_DAYS}+ days)` },
];
const SORT_OPTIONS = [
  { value: "updated", label: "Recently updated" },
  { value: "name", label: "Name A–Z" },
  { value: "price", label: "Price: low to high" },
];
const STOCK_PRIORITY: StockStatus[] = ["out_of_stock", "low_stock", "unknown", "in_stock"];

function pick<T extends { value: string }>(opts: T[], v: string | undefined) {
  return opts.some((o) => o.value === v) ? v : undefined;
}

export default async function ProductsPage({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: SearchParams }) {
  const { shopId } = await params;
  const raw = await searchParams;
  await requireMerchant(`/merchant/${shopId}/products`);
  const ctx = await merchantCtx();
  const { role } = await loadShop(shopId);
  const filters = {
    q: sp(raw.q)?.slice(0, 100) || undefined,
    status: pick(STATUS_OPTIONS, sp(raw.status)) || undefined,
    stock: pick(STOCK_OPTIONS, sp(raw.stock)) || undefined,
    sort: pick(SORT_OPTIONS, sp(raw.sort)) || "updated",
    page: Math.max(1, Number(sp(raw.page)) || 1),
  };
  const result = await guard(listMerchantListings(ctx, shopId, { ...filters, pageSize: 20 }));
  const base = `/merchant/${shopId}/products`;
  const canManage = roleAllows(role, "listing.manage");
  const filtered = Boolean(filters.q || filters.status || filters.stock);
  const hrefFor = (page: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filters, page: String(page) })) if (v && !(k === "sort" && v === "updated") && !(k === "page" && v === "1")) u.set(k, String(v));
    const s = u.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <div>
      <PageHeader
        title="Products"
        description={`${result.total} product${result.total === 1 ? "" : "s"}${filtered ? " match your filters" : ""}`}
        actions={
          canManage ? (
            <LinkButton href={`${base}/new`} icon={<Plus className="size-4" aria-hidden />}>
              Add product
            </LinkButton>
          ) : undefined
        }
      />

      <form method="get" action={base} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end" role="search" aria-label="Filter products">
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="q">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Name, brand or model" className="pl-9" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={filters.status ?? ""}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stock">Stock</Label>
          <Select id="stock" name="stock" defaultValue={filters.stock ?? ""}>
            {STOCK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sort">Sort</Label>
          <Select id="sort" name="sort" defaultValue={filters.sort}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" className="flex-1 lg:flex-none">
            Apply
          </Button>
          {filtered && (
            <LinkButton href={base} variant="ghost">
              Clear
            </LinkButton>
          )}
        </div>
      </form>

      {result.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="size-5" />}
            title={filtered ? "No products match these filters" : "No products yet"}
            description={filtered ? "Try a different search or clear the filters." : "Add products with price and stock so customers nearby can find them."}
            action={
              !filtered && canManage ? (
                <LinkButton href={`${base}/new`} icon={<Plus className="size-4" aria-hidden />}>
                  Add your first product
                </LinkButton>
              ) : filtered ? (
                <LinkButton href={base} variant="outline">
                  Clear filters
                </LinkButton>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {result.items.map((l) => {
              const stock = STOCK_PRIORITY.find((s) => l.stockStatuses.includes(s));
              const stale = l.oldestStockUpdate && stockFreshness(l.oldestStockUpdate) === "stale";
              return (
                <li key={l.id}>
                  <Card className="relative flex gap-3 p-3">
                    <ProductImage src={l.imageUrl} alt={l.name} className="size-16 shrink-0 rounded-lg" sizes="64px" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Link href={`${base}/${l.id}`} className="line-clamp-2 text-sm leading-snug font-semibold after:absolute after:inset-0">
                        {productTitle(l.brand, l.name)}
                        {l.variant ? <span className="font-normal text-muted"> · {l.variant}</span> : null}
                      </Link>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold tabular">{l.minPrice != null ? formatMoney(l.minPrice) : "No price"}</span>
                        <ListingStatusBadge status={l.status as ListingStatus} />
                        {stock && <StockBadge status={stock} quantity={l.totalQuantity} />}
                        {stale && <StaleBadge />}
                      </div>
                      <p className="text-xs text-muted">Updated {relativeTime(l.updatedAt)}</p>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Your products</caption>
              <thead className="border-b border-border bg-surface-2 text-left text-xs text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Price</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Stock</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Last updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.items.map((l) => {
                  const stock = STOCK_PRIORITY.find((s) => l.stockStatuses.includes(s));
                  const stale = l.oldestStockUpdate && stockFreshness(l.oldestStockUpdate) === "stale";
                  return (
                    <tr key={l.id} className="hover:bg-surface-2/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductImage src={l.imageUrl} alt="" className="size-10 shrink-0 rounded-md" sizes="40px" />
                          <div className="min-w-0">
                            <Link href={`${base}/${l.id}`} className="font-medium hover:text-primary">
                              {productTitle(l.brand, l.name)}
                            </Link>
                            {(l.variant || l.model) && <p className="truncate text-xs text-muted">{[l.model, l.variant].filter(Boolean).join(" · ")}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium tabular whitespace-nowrap">{l.minPrice != null ? formatMoney(l.minPrice) : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {stock ? <StockBadge status={stock} quantity={l.totalQuantity} /> : <span className="text-muted">—</span>}
                          {stale && <StaleBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ListingStatusBadge status={l.status as ListingStatus} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{relativeTime(l.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
