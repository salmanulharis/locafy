import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCtx } from "@/modules/auth/context";
import { AccountNav } from "./account-nav";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const ctx = await getCtx();
  if (!ctx.actor) redirect("/login?next=/account");
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-6 md:grid-cols-[13rem_1fr]">
      <AccountNav />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
