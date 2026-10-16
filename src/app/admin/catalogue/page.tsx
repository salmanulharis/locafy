import Link from "next/link";
import { Package } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { FilterTabs, hrefWith, Pagination, pageParam, SearchForm, strParam } from "@/components/admin/filters";
import { DASH, formatDate, formatNumber } from "@/components/admin/format";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listCatalog } from "@/modules/administration/service";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Catalogue" };

const FILTERS = [
  { value: undefined, label: "All" },
  { value: "active", label: "Active" },
  { value: "restricted", label: "Restricted" },
  { value: "merged", label: "Merged" },
] as const;

export default async function AdminCataloguePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminCtx("/admin/catalogue");
  const sp = await searchParams;
  const q = strParam(sp.q);
  const status = FILTERS.find((f) => f.value && f.value === strParam(sp.status))?.value;
  const page = pageParam(sp.page);
  const data = await listCatalog(ctx, { q, status, page, pageSize: 25 });

  return (
    <>
      <PageHeader title="Catalogue" description="Shared product identities. Shops attach their own listings (price and stock) to these entries." />
      <FilterTabs label="Product status" items={FILTERS.map((f) => ({ label: f.label, href: hrefWith("/admin/catalogue", { status: f.value, q }), active: status === f.value }))} />
      <SearchForm action="/admin/catalogue" q={q} placeholder="Search name or model" hidden={{ status }} label="Search catalogue" />
      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Package className="size-5" aria-hidden />} title="No products found" description={q ? `Nothing matches "${q}".` : "No products in this view."} />
        </Card>
      ) : (
        <DataTable
          caption="Catalogue products"
          rows={data.items}
          rowKey={(r) => r.id}
          columns={[
            {
              header: "Product",
              mobileTitle: true,
              cell: (r) => (
                <div className="min-w-0">
                  <Link href={`/admin/catalogue/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-muted">{[r.brand, r.model, r.variant].filter(Boolean).join(" · ") || DASH}</p>
                </div>
              ),
            },
            { header: "Category", cell: (r) => r.category ?? DASH },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { header: "Listings", cell: (r) => <span className="tabular">{formatNumber(r.listingCount)}</span>, className: "text-right" },
            { header: "Added", cell: (r) => formatDate(r.createdAt) },
          ]}
        />
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} href={(p) => hrefWith("/admin/catalogue", { status, q, page: p })} />
    </>
  );
}
