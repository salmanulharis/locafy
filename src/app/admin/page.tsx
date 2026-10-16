import Link from "next/link";
import { Search } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { DASH, formatNumber } from "@/components/admin/format";
import { Card, EmptyState, PageHeader, StatTile } from "@/components/ui/primitives";
import { overview, searchQuality } from "@/modules/administration/service";
import { adminCtx } from "./_lib/guard";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const ctx = await adminCtx();
  const [o, sq] = await Promise.all([overview(ctx), searchQuality(ctx)]);
  const n = (k: string) => (o[k] == null ? null : Number(o[k]));
  const searches = n("searches_7d");
  const zero = n("zero_result_7d");
  const zeroRate = searches && zero != null ? `${((zero / searches) * 100).toFixed(1)}%` : DASH;
  const p95 = n("search_p95_ms");

  const tiles: { label: string; key: string; href?: string; tone?: (v: number) => "warning" | "danger" | undefined }[] = [
    { label: "Users", key: "users", href: "/admin/users" },
    { label: "Shops", key: "shops", href: "/admin/shops" },
    { label: "Pending approvals", key: "pending_shops", href: "/admin/shops?status=pending", tone: (v) => (v > 0 ? "warning" : undefined) },
    { label: "Active shops", key: "active_shops", href: "/admin/shops?status=active" },
    { label: "Published listings", key: "published_listings" },
    { label: "Catalogue products", key: "catalog_products", href: "/admin/catalogue" },
    { label: "Active offers", key: "active_offers" },
    { label: "Open reports", key: "open_reports", href: "/admin/reports", tone: (v) => (v > 0 ? "warning" : undefined) },
    { label: "Paid subscriptions", key: "paid_subscriptions", href: "/admin/plans" },
    { label: "Deletion requests", key: "deletion_requests", href: "/admin/users?status=deletion_requested", tone: (v) => (v > 0 ? "warning" : undefined) },
    { label: "Errors (24 h)", key: "errors_24h", href: "/admin/errors", tone: (v) => (v > 0 ? "danger" : undefined) },
  ];

  return (
    <>
      <PageHeader title="Overview" description="Platform health at a glance. All figures are live counts from the database." />

      <section aria-labelledby="totals" className="mb-8">
        <h2 id="totals" className="sr-only">
          Totals
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {tiles.map((t) => {
            const v = n(t.key);
            const tile = <StatTile label={t.label} value={formatNumber(v)} tone={v != null ? t.tone?.(v) : undefined} />;
            return (
              <li key={t.key}>
                {t.href ? (
                  <Link href={t.href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring [&>div]:hover:border-border-strong">
                    {tile}
                  </Link>
                ) : (
                  tile
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="search-quality" className="mb-8">
        <h2 id="search-quality" className="mb-3 text-heading font-semibold">
          Search quality
        </h2>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Searches (7 days)" value={formatNumber(searches)} />
          <StatTile label="Zero-result rate (7 days)" value={zeroRate} hint={zero != null && searches ? `${formatNumber(zero)} of ${formatNumber(searches)}` : undefined} />
          <StatTile label="p95 latency (7 days)" value={p95 != null ? `${Math.round(p95)} ms` : DASH} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <QueryList title="Top queries (30 days)" rows={sq.top.map((r) => ({ query: r.query, n: r.n, extra: r.avg_results }))} extraLabel="Avg. results" />
          <QueryList title="Top zero-result queries (30 days)" rows={sq.zero.map((r) => ({ query: r.query, n: r.n }))} emptyText="No zero-result searches in the last 30 days." />
        </div>
      </section>
    </>
  );
}

function QueryList({ title, rows, extraLabel, emptyText = "No searches recorded yet." }: { title: string; rows: { query: string; n: number; extra?: number }[]; extraLabel?: string; emptyText?: string }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Search className="size-5" aria-hidden />} title="Nothing yet" description={emptyText} className="py-8" />
        </Card>
      ) : (
        <DataTable
          caption={title}
          rows={rows}
          rowKey={(r) => r.query}
          columns={[
            { header: "Query", cell: (r) => <span className="font-medium break-all">{r.query}</span>, mobileTitle: true },
            { header: "Searches", cell: (r) => <span className="tabular">{formatNumber(r.n)}</span>, className: "text-right w-28" },
            ...(extraLabel ? [{ header: extraLabel, cell: (r: { extra?: number }) => <span className="tabular">{formatNumber(r.extra)}</span>, className: "text-right w-32" }] : []),
          ]}
        />
      )}
    </div>
  );
}
