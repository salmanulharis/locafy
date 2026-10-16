import Link from "next/link";
import { Bell, ChevronDown, LogOut, MessageSquare, Settings, Shield, Store, User } from "lucide-react";
import type { SessionUser } from "@/modules/auth/sessions";
import { logoutAction } from "@/app/(public)/(auth)/actions";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, className = "size-8" }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg ${className}`}>
      {initials(name)}
    </span>
  );
}

/** Account dropdown built on <details> so it works without JavaScript. */
export function UserMenu({ user, unread }: { user: SessionUser; unread: number }) {
  const isAdmin = user.platformRole !== "user";
  const item = "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm hover:bg-surface-2";
  return (
    <details className="group relative">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-full pr-2 pl-1 hover:bg-surface-2 [&::-webkit-details-marker]:hidden" aria-label="Account menu">
        <span className="relative">
          <Avatar name={user.name} />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-danger" aria-label={`${unread} unread notifications`} />}
        </span>
        <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-1.5 text-fg shadow-lg">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <hr className="my-1 border-border" />
        <Link href="/account" className={item}>
          <User className="size-4 text-muted" aria-hidden /> Profile
        </Link>
        <Link href="/account/notifications" className={item}>
          <Bell className="size-4 text-muted" aria-hidden /> Notifications
          {unread > 0 && <span className="ml-auto rounded-full bg-danger px-1.5 text-xs font-semibold text-primary-fg">{unread}</span>}
        </Link>
        <Link href="/account/enquiries" className={item}>
          <MessageSquare className="size-4 text-muted" aria-hidden /> My enquiries
        </Link>
        <Link href="/merchant" className={item}>
          <Store className="size-4 text-muted" aria-hidden /> My shops
        </Link>
        {isAdmin && (
          <Link href="/admin" className={item}>
            <Shield className="size-4 text-muted" aria-hidden /> Administration
          </Link>
        )}
        <Link href="/account/settings" className={item}>
          <Settings className="size-4 text-muted" aria-hidden /> Settings
        </Link>
        <hr className="my-1 border-border" />
        <form action={logoutAction}>
          <button type="submit" className={`${item} w-full text-left`}>
            <LogOut className="size-4 text-muted" aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

