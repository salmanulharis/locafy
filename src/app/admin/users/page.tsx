import Link from "next/link";
import { Users } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { FilterTabs, hrefWith, Pagination, pageParam, SearchForm, strParam } from "@/components/admin/filters";
import { formatDate, formatNumber } from "@/components/admin/format";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listUsers } from "@/modules/administration/service";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Users" };

const FILTERS = [
  { value: undefined, label: "All" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "deletion_requested", label: "Deletion requests" },
  { value: "deleted", label: "Deleted" },
] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminCtx("/admin/users");
  const sp = await searchParams;
  const q = strParam(sp.q);
  const status = FILTERS.find((f) => f.value && f.value === strParam(sp.status))?.value;
  const page = pageParam(sp.page);
  const data = await listUsers(ctx, { q, status, page, pageSize: 25 });

  return (
    <>
      <PageHeader title="Users" description="Customer, merchant and administrator accounts." />
      <FilterTabs label="Account status" items={FILTERS.map((f) => ({ label: f.label, href: hrefWith("/admin/users", { status: f.value, q }), active: status === f.value }))} />
      <SearchForm action="/admin/users" q={q} placeholder="Search name or email" hidden={{ status }} label="Search users" />
      {data.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-5" aria-hidden />} title="No users found" description={q ? `Nothing matches "${q}".` : "No accounts in this view."} />
        </Card>
      ) : (
        <DataTable
          caption="Users"
          rows={data.items}
          rowKey={(r) => r.id}
          columns={[
            {
              header: "User",
              mobileTitle: true,
              cell: (r) => (
                <div className="min-w-0">
                  <Link href={`/admin/users/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs break-all text-muted">{r.email}</p>
                </div>
              ),
            },
            {
              header: "Status",
              cell: (r) => (
                <span className="inline-flex flex-wrap justify-end gap-1">
                  <StatusBadge status={r.status} />
                  {r.deletionRequestedAt && r.status !== "deleted" && <StatusBadge status="deletion_requested" />}
                </span>
              ),
            },
            { header: "Role", cell: (r) => <StatusBadge status={r.platformRole} /> },
            { header: "Shops", cell: (r) => <span className="tabular">{formatNumber(r.shopCount)}</span>, className: "text-right" },
            { header: "Joined", cell: (r) => formatDate(r.createdAt) },
          ]}
        />
      )}
      <Pagination page={data.page} pageSize={data.pageSize} total={data.total} href={(p) => hrefWith("/admin/users", { status, q, page: p })} />
    </>
  );
}
