import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { Alert } from "@/components/ui/primitives";
import { getCtx } from "@/modules/auth/context";
import { loginAction } from "../actions";
import { AuthCard } from "../auth-card";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  const ctx = await getCtx();
  if (ctx.actor) redirect(next?.startsWith("/") ? next : "/");
  return (
    <AuthCard
      title="Sign in to Locafy"
      description="Save products, contact shops and manage your storefront."
      footer={
        <>
          New to Locafy?{" "}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {reset && <Alert tone="success" className="mb-4">Your password was updated. Sign in with your new password.</Alert>}
      <ActionForm action={loginAction}>
        <input type="hidden" name="next" value={next ?? "/"} />
        <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" required />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" required />
        <div className="-mt-1 text-right text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <SubmitButton size="lg">Sign in</SubmitButton>
      </ActionForm>
    </AuthCard>
  );
}
