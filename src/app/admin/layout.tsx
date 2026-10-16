import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { LinkButton } from "@/components/ui/button";
import { adminNavCounts } from "@/modules/administration/service";
import { unreadCount } from "@/modules/notifications/service";
import { adminCtx } from "./_lib/guard";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Locafy Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await adminCtx();
  const [counts, unread] = await Promise.all([adminNavCounts(ctx), unreadCount(ctx)]);
  return (
    <div className="flex min-h-full flex-1 flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[96rem] items-center gap-2 px-4 md:px-6">
          <Logo href="/admin" suffix="Admin" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <AdminMobileNav counts={counts} />
            <span className="hidden sm:block">
              <LinkButton href="/" variant="ghost" size="md" icon={<ExternalLink className="size-4" aria-hidden />}>
                View site
              </LinkButton>
            </span>
            <UserMenu user={ctx.actor!} unread={unread} />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-[96rem] flex-1 px-4 md:px-6">
        <AdminSidebar counts={counts} />
        <main id="main" className="min-w-0 flex-1 py-6 lg:border-l lg:border-border lg:pl-8">
          {children}
        </main>
      </div>
    </div>
  );
}
