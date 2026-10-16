import Link from "next/link";
import { MessageSquareReply } from "lucide-react";
import { deleteReviewAction } from "@/app/(public)/actions";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { ReportDialog } from "@/components/feedback/report-dialog";
import { Card, EmptyState } from "@/components/ui/primitives";
import { canEditReview } from "@/modules/reviews/service";
import { relativeTime } from "./availability";
import { RatingSummary, Stars } from "./rating";
import { ReviewForm } from "./review-form";

type ReviewItem = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorName: string;
  merchantResponse?: string | null;
  merchantRespondedAt?: Date | null;
};

/**
 * Reviews list + the viewer's own review form. Reviews are opinions of
 * Locafy users; they are never presented as verified purchases.
 */
export function ReviewSection({
  targetType,
  targetId,
  average,
  count,
  items,
  viewerId,
  myReview,
  canReview,
  nextPath,
  shopName,
}: {
  targetType: "shop" | "product";
  targetId: string;
  average: number | null;
  count: number;
  items: ReviewItem[];
  viewerId: string | null;
  myReview: { id: string; rating: number; body: string | null; createdAt: Date; status: string } | null;
  canReview: boolean;
  nextPath: string;
  shopName?: string;
}) {
  const editable = myReview && myReview.status !== "removed" && canEditReview(myReview.createdAt);
  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="reviews-heading" className="text-heading font-semibold">
          Reviews
        </h2>
        <RatingSummary average={average} count={count} />
      </div>

      {viewerId ? (
        canReview ? (
          editable || !myReview ? (
            <Card className="p-4">
              <ReviewForm targetType={targetType} targetId={targetId} existing={myReview} />
              {myReview && (
                <div className="mt-3 border-t border-border pt-3">
                  <ConfirmAction action={deleteReviewAction.bind(null, myReview.id)} label="Delete my review" title="Delete your review?" confirmLabel="Delete" variant="ghost" successMessage="Review deleted" />
                </div>
              )}
            </Card>
          ) : (
            <p className="text-sm text-muted">Your review can no longer be edited.</p>
          )
        ) : (
          <p className="text-sm text-muted">You can&apos;t review a shop you work for.</p>
        )
      ) : (
        <p className="text-sm text-muted">
          <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-medium text-primary hover:underline">
            Sign in
          </Link>{" "}
          to write a review.
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState title="No reviews yet" description="Be the first to share your experience." className="py-6" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((r) => (
            <li key={r.id} className="flex flex-col gap-1.5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating} />
                <span className="text-sm font-medium">{r.authorName}</span>
                <span className="text-xs text-muted">
                  {relativeTime(r.createdAt)}
                  {r.updatedAt.getTime() - r.createdAt.getTime() > 60_000 ? " · edited" : ""}
                </span>
              </div>
              {r.body && <p className="text-sm leading-relaxed whitespace-pre-line">{r.body}</p>}
              {r.merchantResponse && (
                <div className="mt-1 flex gap-2 rounded-lg bg-surface-2 p-3 text-sm">
                  <MessageSquareReply className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                  <div>
                    <p className="font-medium">Response from {shopName ?? "the shop"}</p>
                    <p className="mt-0.5 whitespace-pre-line text-muted">{r.merchantResponse}</p>
                  </div>
                </div>
              )}
              {viewerId && viewerId !== r.authorId && (
                <div>
                  <ReportDialog targetType="review" targetId={r.id} label="Report review" signedIn />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
