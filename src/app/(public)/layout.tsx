import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSelectedLocation } from "@/lib/location";
import { getCtx } from "@/modules/auth/context";
import { unreadCount } from "@/modules/notifications/service";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [ctx, location] = await Promise.all([getCtx(), getSelectedLocation()]);
  const unread = await unreadCount(ctx);
  return (
    <>
      <SiteHeader user={ctx.actor} location={location} unread={unread} />
      <main id="main" className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
