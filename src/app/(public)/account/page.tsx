import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { Card, PageHeader } from "@/components/ui/primitives";
import { LinkButton } from "@/components/ui/button";
import { getCtx } from "@/modules/auth/context";
import { getAccount } from "@/modules/auth/service";
import { updateProfileAction } from "../actions";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  const account = await getAccount(await getCtx());
  return (
    <>
      <PageHeader title="Profile" description={`Member since ${new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(account.createdAt)}`} />
      <Card className="p-5">
        <ActionForm action={updateProfileAction} className="max-w-md">
          <TextField name="name" label="Full name" defaultValue={account.name} autoComplete="name" required />
          <TextField name="email" label="Email" defaultValue={account.email} disabled hint="Contact support to change your email." />
          <TextField name="phone" label="Mobile number" type="tel" inputMode="tel" defaultValue={account.phone ?? ""} optional />
          <div>
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ActionForm>
      </Card>
      <Card className="mt-4 flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Run a shop?</h2>
          <p className="text-sm text-muted">Use the same account to manage your storefront.</p>
        </div>
        <LinkButton href="/merchant" variant="outline">
          Go to my shops
        </LinkButton>
      </Card>
    </>
  );
}
