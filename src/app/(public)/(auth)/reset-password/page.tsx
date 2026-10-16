import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { Alert } from "@/components/ui/primitives";
import { resetPasswordAction } from "../actions";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password" description="For your security, you'll be signed out of other devices.">
      {!token ? (
        <Alert tone="warning">This page needs the link from your reset email.</Alert>
      ) : (
        <ActionForm action={resetPasswordAction}>
          <input type="hidden" name="token" value={token} />
          <TextField name="password" label="New password" type="password" autoComplete="new-password" hint="At least 10 characters with a letter and a number." required />
          <SubmitButton size="lg">Update password</SubmitButton>
        </ActionForm>
      )}
    </AuthCard>
  );
}
