import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { CheckboxField, TextField } from "@/components/forms/fields";
import { ConfirmAction } from "@/components/forms/confirm-action";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { getCtx } from "@/modules/auth/context";
import { getAccount } from "@/modules/auth/service";
import { getMyPreferences } from "@/modules/notifications/service";
import { cancelDeletionAction, changePasswordAction, notificationPrefsAction, requestDeletionAction } from "../../actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getCtx();
  const [account, prefs] = await Promise.all([getAccount(ctx), getMyPreferences(ctx)]);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <h2 className="mb-1 text-heading font-semibold">Email notifications</h2>
          <p className="mb-4 text-sm text-muted">In-app notifications are always kept. Choose which ones are also emailed.</p>
          <ActionForm action={notificationPrefsAction}>
            <CheckboxField name="emailEnquiries" label="Enquiry messages and replies" defaultChecked={prefs.emailEnquiries} />
            <CheckboxField name="emailReviews" label="New reviews of my shop" defaultChecked={prefs.emailReviews} />
            <CheckboxField name="emailShopStatus" label="Shop approval and moderation updates" defaultChecked={prefs.emailShopStatus} />
            <CheckboxField name="emailMarketing" label="Locafy news and tips" defaultChecked={prefs.emailMarketing} />
            <div>
              <SubmitButton variant="outline">Save preferences</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-heading font-semibold">Change password</h2>
          <p className="mb-4 text-sm text-muted">You&apos;ll be signed out on all devices and asked to sign in again.</p>
          <ActionForm action={changePasswordAction} className="max-w-md">
            <TextField name="currentPassword" label="Current password" type="password" autoComplete="current-password" required />
            <TextField name="newPassword" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters with a letter and a number." required />
            <div>
              <SubmitButton variant="outline">Update password</SubmitButton>
            </div>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 text-heading font-semibold">Delete account</h2>
          {account.deletionRequestedAt ? (
            <div className="flex flex-col gap-3">
              <Alert tone="warning">
                You requested deletion on {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(account.deletionRequestedAt)}. Our team will remove your personal data and confirm by email.
              </Alert>
              <ActionForm action={cancelDeletionAction}>
                <div>
                  <SubmitButton variant="outline">Cancel deletion request</SubmitButton>
                </div>
              </ActionForm>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">
                We&apos;ll remove your name, email and phone, sign you out everywhere and remove your saved items. Shops you solely own will be taken offline.
              </p>
              <ConfirmAction action={requestDeletionAction} label="Request account deletion" title="Request account deletion?" description="This can't be undone once our team completes it." confirmLabel="Request deletion" variant="outline" />
            </>
          )}
        </Card>
      </div>
    </>
  );
}
