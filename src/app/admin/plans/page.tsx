import Link from "next/link";
import { CreditCard, Pencil, Plus } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { strParam } from "@/components/admin/filters";
import { formatDate, formatNumber } from "@/components/admin/format";
import { Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatMoney, toMajorInput } from "@/lib/money";
import type { Entitlements } from "@/db/schema";
import { listPlans, listSubscriptions } from "@/modules/administration/service";
import { savePlanAction } from "../actions";
import { adminCtx, isSuperAdmin } from "../_lib/guard";

export const metadata = { title: "Plans & subscriptions" };

const LIMITS: { key: keyof Entitlements; label: string; unit?: string }[] = [
  { key: "maxListings", label: "Listings" },
  { key: "maxBranches", label: "Branches" },
  { key: "maxStaff", label: "Staff members" },
  { key: "maxActiveOffers", label: "Active offers" },
  { key: "maxStorageMb", label: "Media storage", unit: "MB" },
];
const FEATURES: { key: keyof Entitlements; label: string }[] = [
  { key: "advancedAnalytics", label: "Advanced analytics" },
  { key: "bulkImport", label: "Bulk import" },
  { key: "promotionScheduling", label: "Promotion scheduling" },
  { key: "sponsoredPlacements", label: "Sponsored placements" },
];

function limitText(v: number, unit?: string) {
  if (v === -1) return "Unlimited";
  return `${formatNumber(v)}${unit ? ` ${unit}` : ""}`;
}

export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await adminCtx("/admin/plans");
  const sp = await searchParams;
  const editId = strParam(sp.edit);
  const [plans, subs] = await Promise.all([listPlans(ctx), listSubscriptions(ctx)]);
  const superAdmin = isSuperAdmin(ctx);
  const editing = editId ? plans.find((p) => p.plan.id === editId)?.plan : undefined;
  const ent = editing?.entitlements;

  return (
    <>
      <PageHeader
        title="Plans & subscriptions"
        description="Plans define what a shop can do. Limits are enforced by the server on every change."
        actions={
          editing && superAdmin ? (
            <LinkButton href="/admin/plans" variant="outline" icon={<Plus className="size-4" aria-hidden />}>
              New plan
            </LinkButton>
          ) : undefined
        }
      />
      <Alert tone="info" title="Billing provider not configured: plans are assigned manually" className="mb-4">
        No payments are collected in Locafy. Assign a plan from a shop&apos;s admin page; the shop owner is notified.
      </Alert>

      <div className="flex flex-col gap-4">
        <Panel title={`Plans (${plans.length})`}>
          {plans.length === 0 ? (
            <EmptyState icon={<CreditCard className="size-5" aria-hidden />} title="No plans" description="Create the first plan below." className="py-6" />
          ) : (
            <DataTable
              caption="Plans"
              rows={plans}
              rowKey={(r) => r.plan.id}
              columns={[
                {
                  header: "Plan",
                  mobileTitle: true,
                  cell: ({ plan }) => (
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {plan.name}
                        {plan.isDefault && <Badge tone="primary">Default</Badge>}
                        {!plan.isActive && <StatusBadge status="inactive" />}
                      </p>
                      <p className="font-mono text-xs text-muted">{plan.code}</p>
                    </div>
                  ),
                },
                { header: "Price", cell: ({ plan }) => (plan.priceMinor > 0 ? `${formatMoney(plan.priceMinor, plan.currency)} / ${plan.interval}` : "Free") },
                {
                  header: "Limits",
                  cell: ({ plan }) => (
                    <span className="text-xs text-muted">
                      {LIMITS.map((l) => `${l.label}: ${limitText(plan.entitlements[l.key] as number, l.unit)}`).join(" · ")}
                    </span>
                  ),
                },
                {
                  header: "Features",
                  cell: ({ plan }) => {
                    const on = FEATURES.filter((f) => plan.entitlements[f.key]);
                    return <span className="text-xs text-muted">{on.length ? on.map((f) => f.label).join(", ") : "None"}</span>;
                  },
                },
                { header: "Live subscriptions", cell: (r) => <span className="tabular">{formatNumber(r.subscribers)}</span>, className: "text-right" },
                {
                  header: "Edit",
                  className: "w-14",
                  cell: ({ plan }) =>
                    superAdmin ? (
                      <Link href={`/admin/plans?edit=${plan.id}#plan-form`} className="inline-flex size-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Edit ${plan.name}`}>
                        <Pencil className="size-4" aria-hidden />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">Super admin only</span>
                    ),
                },
              ]}
            />
          )}
        </Panel>

        <Panel id="plan-form" title={editing ? `Edit “${editing.name}”` : "Create plan"}>
          {!superAdmin ? (
            <Alert tone="info">Only a super administrator can create or edit plans. You can still assign plans to shops.</Alert>
          ) : (
            <ActionForm key={editing?.id ?? "new"} action={savePlanAction.bind(null, editing?.id ?? null)} redirectTo={editing ? "/admin/plans" : undefined} resetOnSuccess={!editing}>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="code" label="Code" defaultValue={editing?.code} required hint="2–30 lowercase letters, numbers, - or _" />
                <TextField name="name" label="Name" defaultValue={editing?.name} required maxLength={40} />
              </div>
              <TextAreaField name="description" label="Description" optional defaultValue={editing?.description ?? ""} rows={2} maxLength={300} />
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField name="price" label="Price (major units)" defaultValue={editing ? toMajorInput(editing.priceMinor) : "0"} inputMode="decimal" required hint="e.g. 499 or 499.50; 0 for free" />
                <SelectField
                  name="interval"
                  label="Billing interval"
                  defaultValue={editing?.interval ?? "month"}
                  options={[
                    { value: "month", label: "Monthly" },
                    { value: "year", label: "Yearly" },
                  ]}
                />
                <TextField name="sortOrder" label="Sort order" type="number" min={0} max={100} inputMode="numeric" defaultValue={String(editing?.sortOrder ?? 0)} />
              </div>
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 text-sm font-medium">Limits</legend>
                <p className="text-sm text-muted">
                  Enter <strong>-1</strong> for unlimited. 0 means the shop cannot use that resource at all.
                </p>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                  {LIMITS.map((l) => (
                    <TextField key={l.key} name={l.key} label={l.unit ? `${l.label} (${l.unit})` : l.label} type="number" min={-1} inputMode="numeric" required defaultValue={String(ent ? (ent[l.key] as number) : 0)} />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Features</legend>
                <div className="grid sm:grid-cols-2">
                  {FEATURES.map((f) => (
                    <CheckboxField key={f.key} name={f.key} label={f.label} defaultChecked={Boolean(ent?.[f.key])} />
                  ))}
                </div>
              </fieldset>
              <CheckboxField name="isActive" label="Active (can be assigned to shops)" defaultChecked={editing ? editing.isActive : true} />
              {editing?.isDefault && <p className="text-sm text-muted">This is the default (free) plan; it cannot be deactivated.</p>}
              <div className="flex flex-wrap gap-2">
                <SubmitButton>{editing ? "Save plan" : "Create plan"}</SubmitButton>
                {editing && (
                  <LinkButton href="/admin/plans" variant="ghost">
                    Cancel
                  </LinkButton>
                )}
              </div>
            </ActionForm>
          )}
        </Panel>

        <Panel title="Subscriptions" description="Latest 100 subscription records, including cancelled ones.">
          {subs.length === 0 ? (
            <EmptyState icon={<CreditCard className="size-5" aria-hidden />} title="No subscriptions yet" description="Shops without a subscription use the default plan." className="py-6" />
          ) : (
            <DataTable
              caption="Subscriptions"
              rows={subs}
              rowKey={(r) => r.s.id}
              columns={[
                {
                  header: "Shop",
                  mobileTitle: true,
                  cell: (r) => (
                    <Link href={`/admin/shops/${r.s.shopId}`} className="font-medium text-primary hover:underline">
                      {r.shopName}
                    </Link>
                  ),
                },
                { header: "Plan", cell: (r) => r.planName },
                { header: "Status", cell: (r) => <StatusBadge status={r.s.status} /> },
                { header: "Provider", cell: (r) => r.s.provider },
                { header: "Started", cell: (r) => formatDate(r.s.createdAt) },
                { header: "Period end", cell: (r) => (r.s.currentPeriodEnd ? formatDate(r.s.currentPeriodEnd) : "No end date") },
              ]}
            />
          )}
        </Panel>
      </div>
    </>
  );
}
