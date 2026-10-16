import type { Metadata } from "next";
import { Check, Minus, UserMinus } from "lucide-react";
import { SubmitButton } from "@/components/forms/action-form";
import { MerchantForm } from "@/components/merchant/merchant-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { SelectField, TextField } from "@/components/forms/fields";
import { Avatar } from "@/components/layout/user-menu";
import { formatDate } from "@/components/merchant/misc";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { roleAllows, SHOP_PERMISSIONS, type ShopPermission, type ShopRole } from "@/modules/access/permissions";
import { listMembers } from "@/modules/shops/service";
import { loadShop, merchantCtx, requireMerchant } from "../../_lib/data";
import { addMemberAction, removeMemberAction } from "../actions";

export const metadata: Metadata = { title: "Team" };

const PERMISSION_LABELS: Record<ShopPermission, string> = {
  "shop.view": "See the shop dashboard and products",
  "shop.edit": "Edit shop details, address and hours",
  "shop.submit": "Submit the shop for verification",
  "shop.members": "Add and remove team members",
  "listing.manage": "Add, edit and publish products",
  "inventory.update": "Update price and stock",
  "offer.manage": "Create and publish offers",
  "enquiry.respond": "Reply to customer enquiries",
  "review.respond": "Respond to reviews",
  "analytics.view": "View analytics",
  "subscription.view": "View the plan",
  "media.upload": "Upload photos",
};
const ROLES: ShopRole[] = ["owner", "manager", "staff"];

export default async function TeamPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const me = await requireMerchant(`/merchant/${shopId}/team`);
  const ctx = await merchantCtx();
  const { role } = await loadShop(shopId);
  const members = await listMembers(ctx, shopId);
  const canManage = roleAllows(role, "shop.members");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Team" description="People who can help run this shop on Locafy." />

      <Card className="divide-y divide-border">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 p-3 sm:p-4">
            <Avatar name={m.name} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <span className="truncate">{m.name}</span>
                {m.userId === me.actor.id && <span className="text-xs font-normal text-muted">(you)</span>}
                <Badge tone={m.role === "owner" ? "primary" : "neutral"} className="capitalize">
                  {m.role}
                </Badge>
              </p>
              <p className="truncate text-sm text-muted">
                {canManage ? `${m.email} · ` : ""}since {formatDate(m.since)}
              </p>
            </div>
            {canManage && m.role !== "owner" && (
              <ConfirmAction
                action={removeMemberAction.bind(null, shopId, m.userId)}
                label={<span className="sr-only sm:not-sr-only">Remove</span>}
                icon={<UserMinus className="size-4" aria-hidden />}
                size="md"
                title={`Remove ${m.name}?`}
                description="They will lose access to this shop immediately. You can add them again later."
                confirmLabel="Remove"
              />
            )}
          </div>
        ))}
      </Card>

      {canManage && (
        <section aria-labelledby="add-h" className="flex flex-col gap-3">
          <h2 id="add-h" className="text-heading font-semibold">
            Add a team member
          </h2>
          <Card className="p-4">
            <MerchantForm action={addMemberAction.bind(null, shopId)} resetOnSuccess planHref={`/merchant/${shopId}/plan`}>
              <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                <TextField name="email" label="Email address" type="email" autoComplete="off" required hint="They need a Locafy account with this email." />
                <SelectField
                  name="role"
                  label="Role"
                  defaultValue="staff"
                  options={[
                    { value: "staff", label: "Staff" },
                    { value: "manager", label: "Manager" },
                  ]}
                />
              </div>
              <div className="flex justify-end">
                <SubmitButton>Add member</SubmitButton>
              </div>
            </MerchantForm>
          </Card>
        </section>
      )}

      <section aria-labelledby="roles-h" className="flex flex-col gap-3">
        <h2 id="roles-h" className="text-heading font-semibold">
          What each role can do
        </h2>
        <Card className="overflow-x-auto" role="region" aria-label="Role permissions table" tabIndex={0}>
          <table className="w-full min-w-[22rem] text-sm">
            <thead className="border-b border-border bg-surface-2 text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-medium">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className="px-2 py-2.5 text-center font-medium capitalize">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(Object.keys(SHOP_PERMISSIONS) as ShopPermission[]).map((p) => (
                <tr key={p}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {PERMISSION_LABELS[p]}
                  </th>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 py-2 text-center">
                      {roleAllows(r, p) ? (
                        <Check className="mx-auto size-4 text-success-soft-fg" aria-label="Yes" />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted" aria-label="No" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
