import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { LinkButton } from "@/components/ui/button";
import { unreadCount } from "@/modules/notifications/service";
import { merchantCtx } from "./_lib/data";

export const metadata: Metadata = {
  title: { default: "Locafy for shops", template: "%s · Locafy for shops" },
  robots: { index: false, follow: false },
};

export default async function MerchantLayout({ children }: { children: ReactNode }) {
  const ctx = await merchantCtx();
  const unread = ctx.actor ? await unreadCount(ctx) : 0;
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
          <Logo href="/merchant" suffix="for shops" />
          <nav aria-label="Account" className="ml-auto flex items-center gap-1">
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg"
            >
              <ExternalLink className="size-4" aria-hidden />
              <span className="hidden sm:inline">Customer site</span>
              <span className="sr-only sm:hidden">Customer site</span>
            </Link>
            {ctx.actor ? (
              <UserMenu user={ctx.actor} unread={unread} />
            ) : (
              <LinkButton href="/login?next=/merchant" variant="ghost" size="sm">
                Sign in
              </LinkButton>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
