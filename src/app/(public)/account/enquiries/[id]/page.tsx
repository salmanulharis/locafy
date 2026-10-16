import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextAreaField } from "@/components/forms/fields";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/primitives";
import { EnquiryThread } from "@/components/shops/enquiry-thread";
import { isAppError } from "@/lib/errors";
import { getCtx } from "@/modules/auth/context";
import { ENQUIRY_STATUS_LABELS } from "@/modules/enquiries/rules";
import { getEnquiryThread } from "@/modules/enquiries/service";
import { closeEnquiryAction, replyEnquiryAction } from "../../../actions";

export const metadata: Metadata = { title: "Enquiry" };

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  let thread;
  try {
    thread = await getEnquiryThread(ctx, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "VALIDATION_ERROR" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }
  if (thread.viewerRole !== "customer") notFound();
  const { enquiry } = thread;
  const closed = enquiry.status === "closed";
  return (
    <>
      <PageHeader
        back={
          <Link href="/account/enquiries" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden /> All enquiries
          </Link>
        }
        title={thread.shopName}
        description={thread.product ? `${thread.product.name}${thread.product.variant ? ` (${thread.product.variant})` : ""} · quantity ${enquiry.quantity}` : "General enquiry"}
        actions={<Badge tone={closed ? "neutral" : enquiry.status === "responded" ? "success" : "warning"}>{ENQUIRY_STATUS_LABELS[enquiry.status]}</Badge>}
      />
      <Card className="flex flex-col gap-5 p-4 sm:p-5">
        <EnquiryThread messages={thread.messages} viewerRole="customer" />
        {closed ? (
          <Alert
            tone="info"
            action={
              <ActionForm action={closeEnquiryAction.bind(null, id, false)}>
                <SubmitButton size="sm" variant="outline">
                  Reopen
                </SubmitButton>
              </ActionForm>
            }
          >
            This enquiry is closed.
          </Alert>
        ) : (
          <div className="border-t border-border pt-4">
            <ActionForm action={replyEnquiryAction.bind(null, id)} resetOnSuccess>
              <TextAreaField name="body" label="Reply" rows={3} required />
              <div className="flex justify-end">
                <SubmitButton>Send</SubmitButton>
              </div>
            </ActionForm>
            <ActionForm action={closeEnquiryAction.bind(null, id, true)} className="mt-2">
              <div>
                <SubmitButton variant="ghost" size="sm">
                  Close enquiry
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}
      </Card>
      {thread.product && (
        <p className="mt-3 text-sm">
          <Link href={`/p/${thread.product.slug}`} className="text-primary hover:underline">
            View product
          </Link>{" "}
          ·{" "}
          <Link href={`/s/${thread.shopSlug}`} className="text-primary hover:underline">
            View shop
          </Link>
        </p>
      )}
    </>
  );
}
