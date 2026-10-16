import Link from "next/link";
import { BadgeCheck, CopyCheck, Store } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { FilterTabs, hrefWith, Pagination, pageParam, SearchForm, strParam } from "@/components/admin/filters";
import { DASH, formatDate, formatNumber } from "@/components/admin/format";
import { StatusBadge } from "@/components/admin/status-badge";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { adminNavCounts, listShops } from "@/modules/administration/service";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Shops" };

const STATUSES = ["pending", "active", "draft", "rejected", "suspended"] as const;

export default async function AdminShopsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminCtx("/admin/shops");
  const sp = await searchParams;
  const q = strParam(sp.q);
  const rawStatus = strParam(sp.status);
  const status = rawStatus === "all" ? undefined : STATUSES.find((s) => s === rawStatus);
  const page = pageParam(sp.page);
  const [data, counts] = await Promise.all([listShops(ctx, { q, status, page, pageSize: 20 }), adminNavCounts(ctx)]);
  const statusParam = rawStatus === "all" ? "all" : status;

  return (
    <>
      <PageHeader title="Shops" description="Review applications, moderate shops and manage verification." />
      <FilterTabs
        label="Shop status"
        items={[
          ...STATUSES.map((s) => ({
            label: s === "pending" ? "Pending approval" : s.charAt(0).toUpperCase() + s.slice(1),
            href: hrefWith("/admin/shops", { status: s, q }),
            active: status === s,
            count: s === "pending" ? counts.pendingShops : undefined,
          })),
          { label: "All", href: hrefWith("/admin/shops", { status: "all", q }), active: !status },
        ]}
      />
      <SearchForm action="/admin/shops" q={q} placeholder="Search shop name" hidden={{ status: statusParam }} label="Search shops" />

      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Store className="size-5" aria-hidden />} title="No shops found" description={q ? `Nothing matches "${q}".` : "No shops with this status."} />
        </Card>
      ) : (
        <DataTable
          caption="Shops"
          rows={data.items}
          rowKey={(r) => r.id}
          columns={[
            {
              header: "Shop",
              mobileTitle: true,
              cell: (r) => (
                <div className="flex flex-col gap-1">
                  <Link href={`/admin/shops/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                  <div className="flex flex-wrap gap-1">
                    {r.isVerified && (
                      <Badge tone="success" icon={<BadgeCheck className="size-3" aria-hidden />}>
                        Verified
                      </Badge>
                    )}
                    {r.possibleDuplicates > 0 && (
                      <Badge tone="warning" icon={<CopyCheck className="size-3" aria-hidden />}>
                        Possible duplicate ({r.possibleDuplicates})
                      </Badge>
                    )}
                  </div>
                </div>
              ),
            },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            { header: "City", cell: (r) => r.city ?? DASH },
            { header: "Published listings", cell: (r) => <span className="tabular">{formatNumber(r.listingCount)}</span>, className: "text-right" },
            { header: status === "pending" ? "Submitted" : "Created", cell: (r) => formatDate(status === "pending" ? r.submittedAt : r.createdAt) },
          ]}
        />
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} href={(p) => hrefWith("/admin/shops", { status: statusParam, q, page: p })} />
    </>
  );
}
