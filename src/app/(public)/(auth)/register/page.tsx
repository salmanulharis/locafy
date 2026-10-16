import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { getCtx } from "@/modules/auth/context";
import { registerAction } from "../actions";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if ((await getCtx()).actor) redirect("/");
  return (
    <AuthCard
      title="Create your account"
      description="One account for shopping locally and for running your shop on Locafy."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <ActionForm action={registerAction}>
        <input type="hidden" name="next" value={next ?? "/"} />
        <TextField name="name" label="Full name" autoComplete="name" required />
        <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" required />
        <TextField name="phone" label="Mobile number" type="tel" autoComplete="tel" inputMode="tel" optional />
        <TextField name="password" label="Password" type="password" autoComplete="new-password" hint="At least 10 characters with a letter and a number." required />
        <SubmitButton size="lg">Create account</SubmitButton>
        <p className="text-xs text-muted">By creating an account you agree to use Locafy respectfully. We never share your contact details with shops without your action.</p>
      </ActionForm>
    </AuthCard>
  );
}
