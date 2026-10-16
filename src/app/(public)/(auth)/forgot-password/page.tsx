import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { forgotPasswordAction } from "../actions";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we'll send you a link to choose a new password."
      footer={
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ActionForm action={forgotPasswordAction} resetOnSuccess>
        <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" required />
        <SubmitButton size="lg">Send reset link</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
