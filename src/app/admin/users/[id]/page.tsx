import Link from "next/link";
import { Ban, RotateCcw } from "lucide-react";
import { AuditList } from "@/components/admin/audit-list";
import { DeleteAccountDialog } from "@/components/admin/delete-account-dialog";
import { DASH, formatDate, formatDateTime } from "@/components/admin/format";
import { BackLink, DetailList, Panel } from "@/components/admin/panel";
import { StatusBadge } from "@/components/admin/status-badge";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { SelectField } from "@/components/forms/fields";
import { Alert, Badge, PageHeader } from "@/components/ui/primitives";
import { getUser } from "@/modules/administration/service";
import { processDeletionAction, reactivateUserAction, setPlatformRoleAction, suspendUserAction } from "../../actions";
import { adminCtx, isSuperAdmin, orNotFound } from "../../_lib/guard";

export const metadata = { title: "User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await adminCtx(`/admin/users/${id}`);
  const { user, memberships, history } = await orNotFound(getUser(ctx, id));
  const isSelf = ctx.actor!.id === user.id;
  const superAdmin = isSuperAdmin(ctx);
  const targetIsAdmin = user.platformRole !== "user";
  const canAct = !isSelf && (superAdmin || !targetIsAdmin) && user.status !== "deleted";

  return (
    <>
      <BackLink href="/admin/users">All users</BackLink>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {user.name}
            <StatusBadge status={user.status} />
            <StatusBadge status={user.platformRole} />
          </span>
        }
        description={<span className="break-all">{user.email}</span>}
      />

      {isSelf && (
        <Alert tone="info" className="mb-4">
          This is your own account. Administrators cannot suspend, delete or change the role of themselves.
        </Alert>
      )}
      {!isSelf && targetIsAdmin && !superAdmin && (
        <Alert tone="info" className="mb-4">
          Only a super administrator can change another administrator&apos;s account.
        </Alert>
      )}
      {user.deletionRequestedAt && user.status !== "deleted" && (
        <Alert tone="warning" title="Account deletion requested" className="mb-4">
          Requested {formatDateTime(user.deletionRequestedAt)}. Process the request below once any open issues are resolved.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel title="Account">
            <DetailList
              items={[
                { label: "Phone", value: user.phone ?? DASH },
                { label: "Email verified", value: user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : "Not verified" },
                { label: "Joined", value: formatDateTime(user.createdAt) },
                { label: "Last updated", value: formatDateTime(user.updatedAt) },
                { label: "Suspension reason", value: user.suspendedReason ?? DASH },
                { label: "Deleted", value: formatDateTime(user.deletedAt) },
              ]}
            />
          </Panel>

          {user.status !== "deleted" && (
            <Panel title="Actions" description="Suspending signs the user out everywhere. All actions are audited.">
              {canAct ? (
                <div className="flex flex-wrap gap-2">
                  {user.status === "active" && (
                    <ConfirmAction
                      action={suspendUserAction.bind(null, user.id)}
                      label="Suspend"
                      title={`Suspend ${user.name}?`}
                      description="They are signed out and cannot sign in until reactivated."
                      confirmLabel="Suspend account"
                      reason={{ label: "Reason", placeholder: "e.g. Spam enquiries to multiple shops." }}
                      size="md"
                      icon={<Ban className="size-4" aria-hidden />}
                    />
                  )}
                  {user.status === "suspended" && (
                    <ActionForm action={reactivateUserAction.bind(null, user.id)}>
                      <SubmitButton variant="outline">
                        <RotateCcw className="size-4" aria-hidden /> Reactivate
                      </SubmitButton>
                    </ActionForm>
                  )}
                  <DeleteAccountDialog action={processDeletionAction.bind(null, user.id)} email={user.email} />
                </div>
              ) : (
                <p className="text-sm text-muted">{isSelf ? "You cannot act on your own account." : "You do not have permission to change this account."}</p>
              )}
            </Panel>
          )}

          <Panel title="Platform role">
            {superAdmin ? (
              isSelf ? (
                <p className="text-sm text-muted">You cannot change your own role.</p>
              ) : user.status === "deleted" ? (
                <p className="text-sm text-muted">Deleted accounts cannot be changed.</p>
              ) : (
                <ActionForm action={setPlatformRoleAction.bind(null, user.id)} className="sm:flex-row sm:items-end">
                  <SelectField
                    name="role"
                    label="Role"
                    defaultValue={user.platformRole}
                    className="sm:w-64"
                    options={[
                      { value: "user", label: "User" },
                      { value: "admin", label: "Admin" },
                      { value: "super_admin", label: "Super admin" },
                    ]}
                  />
                  <SubmitButton variant="outline">Change role</SubmitButton>
                </ActionForm>
              )
            ) : (
              <Alert tone="info">Only a super administrator can change platform roles.</Alert>
            )}
            <p className="mt-3 text-xs text-muted">Changing a role signs the user out of all sessions.</p>
          </Panel>

          <Panel title="Audit history" description="Actions on this account and actions taken by this account (latest 30).">
            <AuditList entries={history} />
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={`Shop memberships (${memberships.length})`}>
            {memberships.length === 0 ? (
              <p className="text-sm text-muted">Not a member of any shop.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {memberships.map((m) => (
                  <li key={m.shopId} className="flex items-center justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <Link href={`/admin/shops/${m.shopId}`} className="flex min-h-11 min-w-0 items-center truncate font-medium text-primary hover:underline">
                      {m.name}
                    </Link>
                    <span className="flex shrink-0 gap-1">
                      <Badge>{m.role}</Badge>
                      <StatusBadge status={m.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <p className="px-1 text-xs text-muted">Account ID: <span className="font-mono break-all">{user.id}</span> · created {formatDate(user.createdAt)}</p>
        </div>
      </div>
    </>
  );
}
