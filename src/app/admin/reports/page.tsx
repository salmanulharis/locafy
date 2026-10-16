import Link from "next/link";
import { Ban, EyeOff, Flag, MegaphoneOff } from "lucide-react";
import { FilterTabs, hrefWith, Pagination, pageParam, strParam } from "@/components/admin/filters";
import { formatDateTime } from "@/components/admin/format";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { SelectField, TextAreaField } from "@/components/forms/fields";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { adminNavCounts, listingProducts, listReports } from "@/modules/administration/service";
import {
  forceUnpublishOfferAction,
  resolveReportAction,
  setCatalogRestrictedAction,
  setListingRestrictedAction,
  setReviewStatusAction,
  suspendShopAction,
} from "../actions";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Reports" };

type ReportRow = {
  id: string;
  target_type: "shop" | "listing" | "product" | "review" | "offer" | "enquiry";
  target_id: string;
  reason: string;
  details: string | null;
  status: "open" | "actioned" | "dismissed";
  resolution_note: string | null;
  resolved_at: string | Date | null;
  created_at: string | Date;
  reporter_name: string | null;
  target_label: string | null;
  open_for_target: number;
};

const STATUSES = ["open", "actioned", "dismissed"] as const;
const PAGE_SIZE = 20;

const TARGET_LABEL: Record<ReportRow["target_type"], string> = {
  shop: "Shop",
  listing: "Listing",
  product: "Product",
  review: "Review",
  offer: "Offer",
  enquiry: "Enquiry",
};

function targetHref(r: ReportRow, listingMap: Record<string, string>): string | null {
  switch (r.target_type) {
    case "shop":
      return `/admin/shops/${r.target_id}`;
    case "product":
      return `/admin/catalogue/${r.target_id}`;
    case "listing":
      return listingMap[r.target_id] ? `/admin/catalogue/${listingMap[r.target_id]}` : null;
    case "review":
      return "/admin/reviews";
    default:
      return null;
  }
}

function QuickAction({ r }: { r: ReportRow }) {
  const common = { size: "md" as const, reason: { label: "Reason (recorded and shared with the affected party)" } };
  switch (r.target_type) {
    case "review":
      return (
        <ConfirmAction
          {...common}
          action={setReviewStatusAction.bind(null, r.target_id, "hidden")}
          label="Hide review"
          title="Hide this review?"
          description="The review is no longer shown publicly. You can restore it from Reviews."
          confirmLabel="Hide review"
          icon={<EyeOff className="size-4" aria-hidden />}
        />
      );
    case "listing":
      return (
        <ConfirmAction
          {...common}
          action={setListingRestrictedAction.bind(null, r.target_id, true)}
          label="Restrict listing"
          title="Restrict this listing?"
          description="The listing is hidden and the shop owner is notified."
          confirmLabel="Restrict listing"
          icon={<Ban className="size-4" aria-hidden />}
        />
      );
    case "product":
      return (
        <ConfirmAction
          {...common}
          action={setCatalogRestrictedAction.bind(null, r.target_id, true)}
          label="Restrict product"
          title="Restrict this catalogue product?"
          description="Shops will not be able to list it."
          confirmLabel="Restrict product"
          icon={<Ban className="size-4" aria-hidden />}
        />
      );
    case "shop":
      return (
        <ConfirmAction
          {...common}
          action={suspendShopAction.bind(null, r.target_id)}
          label="Suspend shop"
          title="Suspend this shop?"
          description="The shop is hidden from customers until reactivated."
          confirmLabel="Suspend shop"
          icon={<Ban className="size-4" aria-hidden />}
        />
      );
    case "offer":
      return (
        <ConfirmAction
          {...common}
          action={forceUnpublishOfferAction.bind(null, r.target_id)}
          label="Unpublish offer"
          title="Unpublish this offer?"
          description="The offer stops showing immediately and the shop is notified."
          confirmLabel="Unpublish offer"
          icon={<MegaphoneOff className="size-4" aria-hidden />}
        />
      );
    default:
      return null;
  }
}

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminCtx("/admin/reports");
  const sp = await searchParams;
  const status = STATUSES.find((s) => s === strParam(sp.status)) ?? "open";
  const page = pageParam(sp.page);
  const [rows, counts] = await Promise.all([listReports(ctx, { status, page, pageSize: PAGE_SIZE }) as Promise<ReportRow[]>, adminNavCounts(ctx)]);
  const listingMap = await listingProducts(
    ctx,
    rows.filter((r) => r.target_type === "listing").map((r) => r.target_id),
  );

  return (
    <>
      <PageHeader title="Reports" description="Content reported by customers and merchants. Resolving a report resolves every open report on the same target." />
      <FilterTabs
        label="Report status"
        items={STATUSES.map((s) => ({
          label: s.charAt(0).toUpperCase() + s.slice(1),
          href: hrefWith("/admin/reports", { status: s === "open" ? undefined : s }),
          active: status === s,
          count: s === "open" ? counts.openReports : undefined,
        }))}
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Flag className="size-5" aria-hidden />} title={status === "open" ? "No open reports" : `No ${status} reports`} description={status === "open" ? "Nothing needs moderation right now." : undefined} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const href = targetHref(r, listingMap);
            return (
              <li key={r.id}>
                <Card className="p-4">
                  <article className="flex flex-col gap-3" aria-labelledby={`report-${r.id}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <Badge tone="info">{TARGET_LABEL[r.target_type]}</Badge>
                          <StatusBadge status={r.status} />
                          {r.open_for_target > 1 && <Badge tone="warning">{r.open_for_target} open reports on this target</Badge>}
                        </p>
                        <h2 id={`report-${r.id}`} className="mt-1.5 font-semibold break-words">
                          {href ? (
                            <Link href={href} className="text-primary hover:underline">
                              {r.target_label ?? "(target no longer exists)"}
                            </Link>
                          ) : (
                            (r.target_label ?? "(target no longer exists)")
                          )}
                        </h2>
                      </div>
                      <time className="text-xs text-muted">{formatDateTime(r.created_at)}</time>
                    </div>
                    <div className="text-sm">
                      <p>
                        <span className="text-muted">Reason: </span>
                        <span className="font-medium">{r.reason}</span>
                      </p>
                      {r.details && <p className="mt-1 whitespace-pre-line break-words text-muted">{r.details}</p>}
                      <p className="mt-1 text-xs text-muted">Reported by {r.reporter_name ?? "an anonymous or deleted user"}</p>
                    </div>

                    {r.status === "open" ? (
                      <div className="flex flex-col gap-3 border-t border-border pt-3">
                        <div className="flex flex-wrap gap-2">
                          <QuickAction r={r} />
                        </div>
                        <ActionForm action={resolveReportAction.bind(null, r.id)} className="gap-3">
                          <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                            <SelectField
                              id={`outcome-${r.id}`}
                              name="outcome"
                              label="Outcome"
                              defaultValue="actioned"
                              options={[
                                { value: "actioned", label: "Actioned" },
                                { value: "dismissed", label: "Dismissed" },
                              ]}
                            />
                            <TextAreaField id={`note-${r.id}`} name="note" label="Resolution note" rows={2} required maxLength={1000} placeholder="What was done and why" />
                          </div>
                          <div>
                            <SubmitButton variant="outline">Resolve report</SubmitButton>
                          </div>
                        </ActionForm>
                      </div>
                    ) : (
                      <div className="border-t border-border pt-3 text-sm">
                        <p className="text-muted">Resolved {formatDateTime(r.resolved_at)}</p>
                        {r.resolution_note && <p className="mt-0.5 whitespace-pre-line break-words">{r.resolution_note}</p>}
                      </div>
                    )}
                  </article>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} hasNext={rows.length === PAGE_SIZE} href={(p) => hrefWith("/admin/reports", { status: status === "open" ? undefined : status, page: p })} />
    </>
  );
}
