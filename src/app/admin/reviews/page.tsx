import { EyeOff, RotateCcw, Star, Trash2 } from "lucide-react";
import { FilterTabs, hrefWith, strParam } from "@/components/admin/filters";
import { formatDateTime } from "@/components/admin/format";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Stars } from "@/components/products/rating";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listReviewsForModeration } from "@/modules/administration/service";
import { setReviewStatusAction } from "../actions";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Reviews" };

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  status: "published" | "hidden" | "removed";
  target_type: "shop" | "product";
  created_at: string | Date;
  author_name: string;
  target_name: string | null;
  open_reports: number;
};

const STATUSES = ["published", "hidden", "removed"] as const;

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminCtx("/admin/reviews");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === strParam(sp.status)) ?? "published";
  const rows = [...(await listReviewsForModeration(ctx, { status }))] as unknown as ReviewRow[];

  return (
    <>
      <PageHeader title="Reviews" description="Reviews with open reports are listed first. Hidden reviews can be restored; removal is for clear policy violations." />
      <FilterTabs
        label="Review status"
        items={STATUSES.map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), href: hrefWith("/admin/reviews", { status: s === "published" ? undefined : s }), active: status === s }))}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Star className="size-5" aria-hidden />} title={`No ${status} reviews`} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="text-sm font-medium">{r.rating}/5</span>
                      <Badge tone="info">{r.target_type === "shop" ? "Shop" : "Product"}</Badge>
                      <StatusBadge status={r.status} />
                      {r.open_reports > 0 && <Badge tone="warning">{r.open_reports} open report{r.open_reports === 1 ? "" : "s"}</Badge>}
                    </p>
                    <p className="mt-1 text-sm break-words">
                      <span className="text-muted">On </span>
                      <span className="font-medium">{r.target_name ?? "(deleted)"}</span>
                      <span className="text-muted"> by {r.author_name}</span>
                    </p>
                  </div>
                  <time className="text-xs text-muted">{formatDateTime(r.created_at)}</time>
                </div>
                <p className="text-sm whitespace-pre-line break-words">{r.body || <span className="text-muted">(rating only, no text)</span>}</p>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  {r.status !== "published" && (
                    <ConfirmAction
                      action={setReviewStatusAction.bind(null, r.id, "published")}
                      label="Restore"
                      title="Restore this review?"
                      description="It becomes visible publicly again."
                      confirmLabel="Restore"
                      confirmVariant="primary"
                      size="md"
                      icon={<RotateCcw className="size-4" aria-hidden />}
                    />
                  )}
                  {r.status !== "hidden" && (
                    <ConfirmAction
                      action={setReviewStatusAction.bind(null, r.id, "hidden")}
                      label="Hide"
                      title="Hide this review?"
                      description="The author is notified. You can restore it later."
                      confirmLabel="Hide review"
                      reason={{ label: "Reason (sent to the author)" }}
                      size="md"
                      icon={<EyeOff className="size-4" aria-hidden />}
                    />
                  )}
                  {r.status !== "removed" && (
                    <ConfirmAction
                      action={setReviewStatusAction.bind(null, r.id, "removed")}
                      label="Remove"
                      title="Remove this review?"
                      description="For clear policy violations. The author is notified."
                      confirmLabel="Remove review"
                      reason={{ label: "Reason (sent to the author)" }}
                      size="md"
                      icon={<Trash2 className="size-4" aria-hidden />}
                    />
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {rows.length >= 100 && <p className="mt-4 text-sm text-muted">Showing the first 100 reviews.</p>}
    </>
  );
}
