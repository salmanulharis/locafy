import Link from "next/link";
import { ScrollText } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { hrefWith, Pagination, pageParam, SearchForm, strParam } from "@/components/admin/filters";
import { DASH, formatDateTime } from "@/components/admin/format";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listAuditLogs } from "@/modules/administration/service";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
const PRESETS = ["admin.", "admin.shop.", "admin.user.", "admin.catalog", "auth.", "shop.", "listing."];

function targetHref(type: string | null, id: string | null) {
  if (!type || !id) return null;
  if (type === "shop") return `/admin/shops/${id}`;
  if (type === "user") return `/admin/users/${id}`;
  if (type === "product") return `/admin/catalogue/${id}`;
  return null;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminCtx("/admin/audit");
  const sp = await searchParams;
  const action = strParam(sp.action)?.slice(0, 60);
  const page = pageParam(sp.page);
  const rows = await listAuditLogs(ctx, { action, page, pageSize: PAGE_SIZE });

  return (
    <>
      <PageHeader title="Audit log" description="Sensitive changes recorded in the same transaction as the change itself." />
      <SearchForm action="/admin/audit" q={action} name="action" placeholder="Filter by action prefix, e.g. admin.shop." label="Filter by action prefix" />
      <p className="-mt-2 mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className="text-muted">Quick filters:</span>
        {PRESETS.map((p) => (
          <Link key={p} href={hrefWith("/admin/audit", { action: p })} className="font-mono text-xs text-primary hover:underline">
            {p}
          </Link>
        ))}
        {action && (
          <Link href="/admin/audit" className="text-xs text-muted underline">
            Clear
          </Link>
        )}
      </p>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<ScrollText className="size-5" aria-hidden />} title="No audit entries" description={action ? `Nothing starts with "${action}".` : undefined} />
        </Card>
      ) : (
        <DataTable
          caption="Audit log"
          rows={rows}
          rowKey={(r) => String(r.log.id)}
          columns={[
            { header: "Action", mobileTitle: true, cell: (r) => <code className="font-mono text-xs font-medium break-all">{r.log.action}</code> },
            {
              header: "Actor",
              cell: (r) =>
                r.log.actorId ? (
                  <Link href={`/admin/users/${r.log.actorId}`} className="text-primary hover:underline">
                    {r.actorName ?? r.log.actorId.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-muted">System</span>
                ),
            },
            {
              header: "Target",
              cell: (r) => {
                const href = targetHref(r.log.targetType, r.log.targetId);
                const label = r.log.targetType ? `${r.log.targetType} ${r.log.targetId?.slice(0, 8) ?? ""}` : DASH;
                return href ? (
                  <Link href={href} className="text-primary hover:underline">
                    {label}
                  </Link>
                ) : (
                  <span className="break-all">{label}</span>
                );
              },
            },
            {
              header: "Details",
              cell: (r) =>
                r.log.metadata && Object.keys(r.log.metadata).length ? (
                  <details className="text-left">
                    <summary className="cursor-pointer text-xs text-muted">Metadata</summary>
                    <pre className="mt-1 max-w-xs overflow-x-auto rounded bg-surface-2 p-2 text-xs whitespace-pre-wrap break-all">{JSON.stringify(r.log.metadata, null, 2)}</pre>
                  </details>
                ) : (
                  DASH
                ),
            },
            { header: "IP", cell: (r) => <span className="font-mono text-xs">{r.log.ip ?? DASH}</span>, hideOnMobile: true },
            { header: "Time", cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.log.createdAt)}</span> },
          ]}
        />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} hasNext={rows.length === PAGE_SIZE} href={(p) => hrefWith("/admin/audit", { action, page: p })} />
    </>
  );
}
