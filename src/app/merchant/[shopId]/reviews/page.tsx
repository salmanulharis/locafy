import type { Metadata } from "next";
import { Star } from "lucide-react";
import { SubmitButton } from "@/components/forms/action-form";
import { MerchantForm } from "@/components/merchant/merchant-form";
import { TextAreaField } from "@/components/forms/fields";
import { formatDate } from "@/components/merchant/misc";
import { RatingSummary, Stars } from "@/components/products/rating";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { roleAllows } from "@/modules/access/permissions";
import { listShopReviews } from "@/modules/reviews/service";
import { loadShop, merchantCtx, requireMerchant } from "../../_lib/data";
import { respondAction } from "./actions";

export const metadata: Metadata = { title: "Reviews" };

export default async function ReviewsPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  await requireMerchant(`/merchant/${shopId}/reviews`);
  const ctx = await merchantCtx();
  const { role } = await loadShop(shopId);
  const canRespond = roleAllows(role, "review.respond");
  const reviews = await listShopReviews(ctx, shopId, { includeHidden: true });

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="What customers say about your shop. Replies are shown publicly under the review."
        actions={<RatingSummary average={reviews.average} count={reviews.count} />}
      />
      {reviews.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Star className="size-5" />} title="No reviews yet" description="Customers can review your shop from your public shop page." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.items.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  <span className="text-sm font-medium">{r.authorName}</span>
                  <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                  {r.status !== "published" && <Badge tone="warning">{r.status === "hidden" ? "Hidden by a moderator" : "Removed"}</Badge>}
                </div>
                {r.body ? <p className="text-sm whitespace-pre-line">{r.body}</p> : <p className="text-sm text-muted">Rating only, no comment.</p>}
                {r.merchantResponse && (
                  <div className="rounded-lg bg-surface-2 p-3 text-sm">
                    <p className="mb-0.5 text-xs font-medium text-muted">Your response · {formatDate(r.merchantRespondedAt)}</p>
                    <p className="whitespace-pre-line">{r.merchantResponse}</p>
                  </div>
                )}
                {canRespond && r.status === "published" && (
                  <details className="group">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">
                      {r.merchantResponse ? "Edit response" : "Respond"}
                    </summary>
                    <MerchantForm action={respondAction.bind(null, r.id)} className="mt-2">
                      <TextAreaField
                        id={`response-${r.id}`}
                        name="response"
                        label="Public response"
                        rows={3}
                        maxLength={1000}
                        defaultValue={r.merchantResponse ?? ""}
                        hint="Be polite and specific. Don't include personal details."
                        required
                      />
                      <div className="flex justify-end">
                        <SubmitButton>Publish response</SubmitButton>
                      </div>
                    </MerchantForm>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
