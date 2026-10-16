import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { relativeTime } from "@/components/products/availability";
import { cn } from "@/lib/cn";
import { getCtx } from "@/modules/auth/context";
import { listNotifications } from "@/modules/notifications/service";
import { markNotificationsReadAction } from "../../actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { items, unreadCount } = await listNotifications(await getCtx(), { limit: 50 });
  return (
    <>
      <PageHeader
        title="Notifications"
        description={unreadCount ? `${unreadCount} unread` : "You're all caught up."}
        actions={
          unreadCount > 0 ? (
            <form action={markNotificationsReadAction}>
              <Button type="submit" variant="outline" size="sm">
                Mark all as read
              </Button>
            </form>
          ) : undefined
        }
      />
      {items.length ? (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {items.map((n) => {
            const body = (
              <div className="flex gap-3 p-4">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                <div className="min-w-0">
                  <p className={cn("text-sm", !n.readAt && "font-semibold")}>
                    {n.title}
                    {!n.readAt && <span className="sr-only"> (unread)</span>}
                  </p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{relativeTime(n.createdAt)}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-surface-2">{body}</Link> : body}</li>;
          })}
        </ul>
      ) : (
        <Card>
          <EmptyState icon={<Bell className="size-5" />} title="No notifications yet" description="Replies to your enquiries and shop updates will appear here." />
        </Card>
      )}
    </>
  );
}
