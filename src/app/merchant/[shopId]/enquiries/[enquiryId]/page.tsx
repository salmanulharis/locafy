import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/forms/action-form";
import { MerchantForm } from "@/components/merchant/merchant-form";
import { TextAreaField } from "@/components/forms/fields";
import { Avatar } from "@/components/layout/user-menu";
import { BackLink, formatDateTime, NoAccess } from "@/components/merchant/misc";
import { ReportButton } from "@/components/merchant/report-button";
import { EnquiryStatusBadge } from "@/components/merchant/status";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { roleAllows } from "@/modules/access/permissions";
import type { EnquiryStatus } from "@/modules/enquiries/rules";
import { getEnquiryThread } from "@/modules/enquiries/service";
import { guard, isUuid, loadShop, merchantCtx, requireMerchant } from "../../../_lib/data";
import { replyAction, reportEnquiryAction, setClosedAction } from "../actions";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryThreadPage({ params }: { params: Promise<{ shopId: string; enquiryId: string }> }) {
  const { shopId, enquiryId } = await params;
  await requireMerchant(`/merchant/${shopId}/enquiries/${enquiryId}`);
  if (!isUuid(enquiryId)) notFound();
  const ctx = await merchantCtx();
  const { role } = await loadShop(shopId);
  if (!roleAllows(role, "enquiry.respond")) return <NoAccess what="answering enquiries" />;
  const thread = await guard(getEnquiryThread(ctx, enquiryId));
  if (thread.enquiry.shopId !== shopId || thread.viewerRole !== "merchant") notFound();
  const status = thread.enquiry.status as EnquiryStatus;
  const closed = status === "closed";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        back={<BackLink href={`/merchant/${shopId}/enquiries`}>Enquiries</BackLink>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {thread.customerName} <EnquiryStatusBadge status={status} />
          </span>
        }
        description={
          thread.product ? (
            <>
              About{" "}
              <Link href={`/p/${thread.product.slug}`} className="font-medium text-primary hover:underline">
                {thread.product.name}
                {thread.product.variant ? ` (${thread.product.variant})` : ""}
              </Link>
              {thread.enquiry.quantity > 1 ? ` · quantity ${thread.enquiry.quantity}` : ""}
            </>
          ) : (
            "General enquiry about your shop"
          )
        }
        actions={
          <>
            <MerchantForm action={setClosedAction.bind(null, enquiryId, !closed)} className="gap-0">
              <SubmitButton variant="outline">{closed ? "Reopen" : "Mark as closed"}</SubmitButton>
            </MerchantForm>
            <ReportButton action={reportEnquiryAction.bind(null, enquiryId)} />
          </>
        }
      />

      <ol className="flex flex-col gap-3" aria-label="Messages">
        {thread.messages.map((m) => {
          const mine = m.senderRole === "merchant";
          return (
            <li key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              <Avatar name={m.senderName ?? "?"} />
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm", mine ? "rounded-tr-sm bg-primary-soft text-fg" : "rounded-tl-sm border border-border bg-surface")}>
                <p className="mb-0.5 text-xs text-muted">
                  <span className="font-medium text-fg">{mine ? `${m.senderName} (your shop)` : m.senderName}</span> · {formatDateTime(m.createdAt)}
                </p>
                <p className="whitespace-pre-line break-words">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {closed ? (
        <Alert tone="info">This enquiry is closed. Reopen it to reply.</Alert>
      ) : (
        <Card className="p-4">
          <MerchantForm action={replyAction.bind(null, enquiryId)} resetOnSuccess>
            <TextAreaField
              name="body"
              label="Your reply"
              rows={4}
              maxLength={2000}
              required
              hint="Don't share payment details here. Customers see your shop name, not your personal name."
            />
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Sending…">Send reply</SubmitButton>
            </div>
          </MerchantForm>
        </Card>
      )}
    </div>
  );
}
