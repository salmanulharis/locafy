import Link from "next/link";
import { Megaphone } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { formatDateTime, toDateTimeLocal } from "@/components/admin/format";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { TextField } from "@/components/forms/fields";
import { Alert, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listSponsoredPlacements } from "@/modules/administration/service";
import { createSponsoredAction, deactivateSponsoredAction } from "../actions";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Sponsored" };

function windowState(sp: { isActive: boolean; startsAt: Date; endsAt: Date }, now: Date) {
  if (!sp.isActive) return { status: "inactive", label: "Deactivated" };
  if (sp.endsAt <= now) return { status: "archived", label: "Ended" };
  if (sp.startsAt > now) return { status: "pending", label: "Scheduled" };
  return { status: "active", label: "Running" };
}

export default async function AdminSponsoredPage() {
  const ctx = await adminCtx("/admin/sponsored");
  const rows = await listSponsoredPlacements(ctx);
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60_000);
  const end = new Date(now.getTime() + 7 * 86_400_000);

  return (
    <>
      <PageHeader title="Sponsored placements" description="Promote a published listing in search results for a fixed window." />
      <Alert tone="info" className="mb-4">
        Sponsored results are always labelled “Sponsored” to customers and never change a listing&apos;s price or availability. The shop&apos;s plan must
        include sponsored placements.
      </Alert>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Panel title={`Placements (${rows.length})`} description="Latest 100.">
          {rows.length === 0 ? (
            <EmptyState icon={<Megaphone className="size-5" aria-hidden />} title="No sponsored placements" description="Create one with the form." className="py-6" />
          ) : (
            <DataTable
              caption="Sponsored placements"
              rows={rows}
              rowKey={(r) => r.sp.id}
              columns={[
                {
                  header: "Listing",
                  mobileTitle: true,
                  cell: (r) => (
                    <div className="min-w-0">
                      <p className="font-medium">{r.productName}</p>
                      <Link href={`/admin/shops/${r.sp.shopId}`} className="text-xs text-primary hover:underline">
                        {r.shopName}
                      </Link>
                    </div>
                  ),
                },
                {
                  header: "Window",
                  cell: (r) => (
                    <span className="text-xs">
                      {formatDateTime(r.sp.startsAt)} → {formatDateTime(r.sp.endsAt)}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (r) => {
                    const s = windowState(r.sp, now);
                    return <StatusBadge status={s.status} label={s.label} />;
                  },
                },
                {
                  header: "Action",
                  className: "text-right",
                  cell: (r) =>
                    r.sp.isActive && r.sp.endsAt > now ? (
                      <ConfirmAction
                        action={deactivateSponsoredAction.bind(null, r.sp.id)}
                        label="Deactivate"
                        title="Deactivate this placement?"
                        description="The listing stops appearing as sponsored immediately."
                        confirmLabel="Deactivate"
                        size="md"
                      />
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    ),
                },
              ]}
            />
          )}
        </Panel>
        <div className="xl:sticky xl:top-20 xl:self-start">
          <Panel title="New placement">
            <ActionForm action={createSponsoredAction} resetOnSuccess>
              <TextField name="listingId" label="Listing ID" required placeholder="UUID of a published listing" autoComplete="off" hint="Find listing IDs on a catalogue product page." />
              <TextField name="startsAt" label="Starts" type="datetime-local" required defaultValue={toDateTimeLocal(start)} hint="Server time zone." />
              <TextField name="endsAt" label="Ends" type="datetime-local" required defaultValue={toDateTimeLocal(end)} />
              <div>
                <SubmitButton>Create placement</SubmitButton>
              </div>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </>
  );
}
