import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { relativeTime } from "@/components/products/availability";
import { getCtx } from "@/modules/auth/context";
import { ENQUIRY_STATUS_LABELS } from "@/modules/enquiries/rules";
import { listMyEnquiries } from "@/modules/enquiries/service";

export const metadata: Metadata = { title: "My enquiries" };

const TONE = { open: "warning", responded: "success", closed: "neutral" } as const;

export default async function MyEnquiriesPage() {
  const items = await listMyEnquiries(await getCtx());
  return (
    <>
      <PageHeader title="My enquiries" description="Questions you've sent to shops and their replies." />
      {items.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {items.map((e) => (
            <li key={e.id}>
              <Link href={`/account/enquiries/${e.id}`} className="flex flex-col gap-1 p-4 hover:bg-surface-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{e.shopName}</span>
                  <Badge tone={TONE[e.status]}>{e.status === "open" ? "Waiting for shop" : ENQUIRY_STATUS_LABELS[e.status]}</Badge>
                </div>
                {e.productName && (
                  <p className="truncate text-sm">
                    {e.productName}
                    {e.productVariant ? ` (${e.productVariant})` : ""} · qty {e.quantity}
                  </p>
                )}
                <p className="line-clamp-1 text-sm text-muted">{e.preview}</p>
                <p className="text-xs text-muted">{relativeTime(e.lastMessageAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={<MessageSquare className="size-5" />} title="No enquiries yet" description="Use “Ask the shop” on a product or shop page to check availability." />
        </Card>
      )}
    </>
  );
}
