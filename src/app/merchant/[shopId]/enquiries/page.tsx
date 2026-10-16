import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { relativeTime } from "@/components/products/availability";
import { LinkTabs, NoAccess } from "@/components/merchant/misc";
import { EnquiryStatusBadge } from "@/components/merchant/status";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { roleAllows } from "@/modules/access/permissions";
import type { EnquiryStatus } from "@/modules/enquiries/rules";
import { listShopEnquiries } from "@/modules/enquiries/service";
import { loadShop, merchantCtx, requireMerchant, sp, type SearchParams } from "../../_lib/data";

export const metadata: Metadata = { title: "Enquiries" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "open", label: "Awaiting reply" },
  { key: "responded", label: "Replied" },
  { key: "closed", label: "Closed" },
];

export default async function EnquiriesPage({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: SearchParams }) {
  const { shopId } = await params;
  const q = await searchParams;
  await requireMerchant(`/merchant/${shopId}/enquiries`);
  const ctx = await merchantCtx();
  const { role } = await loadShop(shopId);
  if (!roleAllows(role, "enquiry.respond")) return <NoAccess what="answering enquiries" />;
  const status = FILTERS.some((f) => f.key && f.key === sp(q.status)) ? (sp(q.status) as EnquiryStatus) : undefined;
  const items = await listShopEnquiries(ctx, shopId, status ? { status } : {});
  const base = `/merchant/${shopId}/enquiries`;

  return (
    <div>
      <PageHeader title="Enquiries" description="Questions from customers about availability and prices. Reply here — customers are notified." />
      <LinkTabs label="Filter enquiries" items={FILTERS.map((f) => ({ href: f.key ? `${base}?status=${f.key}` : base, label: f.label, active: (status ?? "") === f.key }))} />
      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MessageSquare className="size-5" />}
            title={status ? "Nothing here" : "No enquiries yet"}
            description={status ? "No enquiries with this status." : "When customers ask about your products, their messages appear here."}
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((e) => (
            <li key={e.id}>
              <Card className={cn("relative flex flex-col gap-1 p-3 hover:shadow-md sm:p-4", e.status === "open" && "border-warning")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`${base}/${e.id}`} className="font-semibold after:absolute after:inset-0 hover:text-primary">
                    {e.customerName}
                  </Link>
                  <EnquiryStatusBadge status={e.status as EnquiryStatus} />
                  <span className="ml-auto text-xs text-muted">{relativeTime(e.lastMessageAt)}</span>
                </div>
                <p className="text-sm text-muted">
                  {e.productName ? `${e.productName}${e.productVariant ? ` (${e.productVariant})` : ""}` : "General enquiry"}
                  {e.quantity > 1 ? ` · qty ${e.quantity}` : ""}
                </p>
                {e.preview && <p className="line-clamp-2 text-sm">{e.preview}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
