"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { runAction, type ActionState } from "@/lib/actions";
import { formDataToObject } from "@/lib/validation";
import { getCtx } from "@/modules/auth/context";
import * as auth from "@/modules/auth/service";
import { SESSION_COOKIE } from "@/modules/auth/sessions";

async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Only allow same-site relative redirects after sign-in. */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const input = formDataToObject(fd);
  const result = await runAction(async (ctx) => {
    const r = await auth.login(ctx, input);
    await setSessionCookie(r.token, r.expiresAt);
  });
  if (result.ok) redirect(safeNext(input.next));
  return result;
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const input = formDataToObject(fd);
  const result = await runAction(async (ctx) => {
    const r = await auth.register(ctx, input);
    await setSessionCookie(r.token, r.expiresAt);
  });
  if (result.ok) redirect(safeNext(input.next));
  return result;
}

export async function logoutAction() {
  const ctx = await getCtx();
  await auth.logout(ctx);
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(
    (ctx) => auth.requestPasswordReset(ctx, formDataToObject(fd)),
    "If an account exists for that email, we've sent a reset link.",
  );
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await runAction((ctx) => auth.resetPassword(ctx, formDataToObject(fd)));
  if (result.ok) redirect("/login?reset=1");
  return result;
}
