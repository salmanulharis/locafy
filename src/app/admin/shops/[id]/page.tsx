import Link from "next/link";
import { BadgeCheck, Ban, CheckCircle2, ExternalLink, MapPin, RotateCcw, ShieldCheck, ShieldOff, XCircle } from "lucide-react";
import { AuditList } from "@/components/admin/audit-list";
import { DASH, formatDate, formatDateTime } from "@/components/admin/format";
import { BackLink, DetailList, Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { Alert, Badge, PageHeader } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { getShopForAdmin, listPlans } from "@/modules/administration/service";
import {
  approveShopAction,
  assignPlanAction,
  correctShopInfoAction,
  reactivateShopAction,
  rejectShopAction,
  setShopVerifiedAction,
  suspendShopAction,
} from "../../actions";
import { adminCtx, orNotFound } from "../../_lib/guard";

export const metadata = { title: "Shop" };

type BranchRow = {
  id: string;
  name: string;
  address_line: string;
  locality: string | null;
  city: string;
  postal_code: string | null;
  is_primary: boolean;
  lat: number | null;
  lng: number | null;
};

export default async function AdminShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await adminCtx(`/admin/shops/${id}`);
  const [data, plans] = await Promise.all([orNotFound(getShopForAdmin(ctx, id)), listPlans(ctx)]);
  const { shop, members, category, plan, history, duplicates } = data;
  const branches = data.branches as BranchRow[];
  const activePlans = plans.filter((p) => p.plan.isActive);

  return (
    <>
      <BackLink href="/admin/shops">All shops</BackLink>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {shop.name}
            <StatusBadge status={shop.status} />
            {shop.isVerified && (
              <Badge tone="success" icon={<BadgeCheck className="size-3" aria-hidden />}>
                Verified
              </Badge>
            )}
          </span>
        }
        description={`/${shop.slug} · created ${formatDate(shop.createdAt)}`}
        actions={
          shop.status === "active" ? (
            <Link href={`/s/${shop.slug}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline">
              Public page <ExternalLink className="size-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />

      {shop.statusReason && (
        <Alert tone={shop.status === "active" ? "info" : "warning"} title="Last status reason" className="mb-4">
          {shop.statusReason}
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Moderation" description="Every decision is recorded with the moderator and reason, and shop owners are notified.">
            <div className="flex flex-wrap gap-2">
              {shop.status === "pending" && (
                <>
                  <ConfirmAction
                    action={approveShopAction.bind(null, shop.id)}
                    label="Approve"
                    title={`Approve ${shop.name}?`}
                    description="The shop and its published listings become visible to customers."
                    confirmLabel="Approve shop"
                    confirmVariant="primary"
                    variant="primary"
                    size="md"
                    icon={<CheckCircle2 className="size-4" aria-hidden />}
                  />
                  <ConfirmAction
                    action={rejectShopAction.bind(null, shop.id)}
                    label="Reject"
                    title={`Reject ${shop.name}?`}
                    description="The owner sees your reason and can fix the application and resubmit."
                    confirmLabel="Reject application"
                    reason={{ label: "Reason shown to the owner", placeholder: "e.g. The address could not be verified." }}
                    size="md"
                    icon={<XCircle className="size-4" aria-hidden />}
                  />
                </>
              )}
              {(shop.status === "active" || shop.status === "pending") && (
                <ConfirmAction
                  action={suspendShopAction.bind(null, shop.id)}
                  label="Suspend"
                  title={`Suspend ${shop.name}?`}
                  description="The shop disappears from search and its public page until reactivated."
                  confirmLabel="Suspend shop"
                  reason={{ label: "Reason", placeholder: "e.g. Repeated misleading prices reported." }}
                  size="md"
                  icon={<Ban className="size-4" aria-hidden />}
                />
              )}
              {shop.status === "suspended" && (
                <ConfirmAction
                  action={reactivateShopAction.bind(null, shop.id)}
                  label="Reactivate"
                  title={`Reactivate ${shop.name}?`}
                  description="The shop becomes visible again."
                  confirmLabel="Reactivate"
                  confirmVariant="primary"
                  variant="primary"
                  size="md"
                  icon={<RotateCcw className="size-4" aria-hidden />}
                />
              )}
              <ActionForm action={setShopVerifiedAction.bind(null, shop.id, !shop.isVerified)}>
                <SubmitButton variant="outline">
                  {shop.isVerified ? <ShieldOff className="size-4" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
                  {shop.isVerified ? "Remove verification" : "Mark as verified"}
                </SubmitButton>
              </ActionForm>
            </div>
            {(shop.status === "draft" || shop.status === "rejected") && (
              <p className="mt-3 text-sm text-muted">
                {shop.status === "draft" ? "This shop has not been submitted for review yet." : "Waiting for the owner to update and resubmit."}
              </p>
            )}
          </Panel>

          <Panel title="Details">
            <DetailList
              items={[
                { label: "Category", value: category?.name ?? DASH },
                { label: "Phone", value: shop.phone ?? DASH },
                { label: "WhatsApp", value: shop.whatsapp ?? DASH },
                { label: "Email", value: shop.email ?? DASH },
                { label: "Website", value: shop.website ?? DASH },
                { label: "Submitted", value: formatDateTime(shop.submittedAt) },
                { label: "Approved", value: formatDateTime(shop.approvedAt) },
                { label: "Onboarding step", value: String(shop.onboardingStep) },
              ]}
            />
            <div className="mt-4 text-sm">
              <p className="text-muted">Description</p>
              <p className="mt-0.5 whitespace-pre-line">{shop.description || DASH}</p>
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-border-strong p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="size-4 text-muted" aria-hidden /> Verification note <Badge>Private</Badge>
              </p>
              <p className="mt-1 whitespace-pre-line text-muted">{shop.verificationNote || "The owner did not provide verification details."}</p>
            </div>
          </Panel>

          <Panel title={`Branches (${branches.length})`}>
            {branches.length === 0 ? (
              <p className="text-sm text-muted">No branches added.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {branches.map((b) => {
                  const hasCoords = b.lat != null && b.lng != null;
                  return (
                    <li key={b.id} className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {b.name} {b.is_primary && <Badge tone="primary">Primary</Badge>}
                      </p>
                      <p className="text-muted">{[b.address_line, b.locality, b.city, b.postal_code].filter(Boolean).join(", ")}</p>
                      {hasCoords ? (
                        <p className="flex flex-wrap items-center gap-x-3">
                          <span className="font-mono text-xs">
                            {Number(b.lat).toFixed(5)}, {Number(b.lng).toFixed(5)}
                          </span>
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${b.lat}&mlon=${b.lng}#map=18/${b.lat}/${b.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline"
                          >
                            <MapPin className="size-4" aria-hidden /> Open in OpenStreetMap <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        </p>
                      ) : (
                        <Badge tone="warning">No coordinates — excluded from distance search</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Correct shop information" description="Use for typos or policy fixes. Changes are audited with before/after values.">
            <ActionForm action={correctShopInfoAction.bind(null, shop.id)}>
              <TextField name="name" label="Shop name" defaultValue={shop.name} required maxLength={80} />
              <TextAreaField name="description" label="Description" optional defaultValue={shop.description ?? ""} maxLength={1000} rows={3} />
              <TextField name="phone" label="Phone" optional defaultValue={shop.phone ?? ""} maxLength={30} />
              <div>
                <SubmitButton>Save corrections</SubmitButton>
              </div>
            </ActionForm>
          </Panel>

          <Panel title="History">
            <AuditList entries={history} />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Plan">
            <p className="text-sm">
              <span className="font-medium">{plan.plan?.name ?? "No plan"}</span>
              {plan.plan && <span className="text-muted"> · {plan.plan.priceMinor > 0 ? `${formatMoney(plan.plan.priceMinor, plan.plan.currency)}/${plan.plan.interval}` : "Free"}</span>}
            </p>
            <p className="mt-1 text-xs text-muted">
              {plan.subscription
                ? `Assigned ${formatDate(plan.subscription.createdAt)} via ${plan.subscription.provider}${plan.subscription.currentPeriodEnd ? ` · ends ${formatDate(plan.subscription.currentPeriodEnd)}` : " · no end date"}`
                : "Default plan (no subscription record)."}
            </p>
            <ActionForm action={assignPlanAction.bind(null, shop.id)} className="mt-4">
              <SelectField
                name="planId"
                label="Assign plan"
                defaultValue={plan.plan?.id ?? ""}
                options={activePlans.map((p) => ({ value: p.plan.id, label: `${p.plan.name}${p.plan.isDefault ? " (default)" : ""}` }))}
                hint="Billing provider not configured: plans are assigned manually."
              />
              <TextField name="periodDays" label="Period (days)" type="number" min={1} max={730} optional hint="Leave empty for no end date." inputMode="numeric" />
              <div>
                <SubmitButton variant="outline">Assign plan</SubmitButton>
              </div>
            </ActionForm>
          </Panel>

          <Panel title={`Members (${members.length})`}>
            {members.length === 0 ? (
              <p className="text-sm text-muted">No members.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-start justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/admin/users/${m.userId}`} className="font-medium text-primary hover:underline">
                        {m.name}
                      </Link>
                      <p className="truncate text-xs text-muted">{m.email}</p>
                    </div>
                    <Badge>{m.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Similar names" description="Shops with a similar name (possible duplicates).">
            {duplicates.length === 0 ? (
              <p className="text-sm text-muted">No similar shop names found.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {duplicates.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/admin/shops/${d.id}`} className="flex min-h-11 min-w-0 items-center truncate text-primary hover:underline">
                      {d.name}
                    </Link>
                    <StatusBadge status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
