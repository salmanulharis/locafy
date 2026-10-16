"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  Settings,
  Star,
  Tag,
  Users,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

export type NavKey = "dashboard" | "products" | "offers" | "enquiries" | "reviews" | "analytics" | "team" | "plan" | "settings";

export type NavItem = { key: NavKey; href: string; label: string; count?: number };

const ICONS: Record<NavKey, typeof Package> = {
  dashboard: LayoutDashboard,
  products: Package,
  offers: Tag,
  enquiries: MessageSquare,
  reviews: Star,
  analytics: BarChart3,
  team: Users,
  plan: CreditCard,
  settings: Settings,
};

function isActive(pathname: string, item: NavItem) {
  if (item.key === "dashboard") return pathname === item.href;
  if (item.key === "settings") return pathname.startsWith(item.href) || pathname.endsWith("/onboarding");
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Count({ n, active }: { n?: number; active: boolean }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "ml-auto min-w-6 rounded-full px-1.5 text-center text-xs font-semibold tabular",
        active ? "bg-primary text-primary-fg" : "bg-warning-soft text-warning-soft-fg",
      )}
    >
      {n}
      <span className="sr-only"> open</span>
    </span>
  );
}

/** Desktop sidebar. */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Shop sections" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
              active ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {item.label}
            <Count n={item.count} active={active} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: current section + a sheet with every section. */
export function MobileNav({ items, shopName }: { items: NavItem[]; shopName: string }) {
  const pathname = usePathname();
  const current = items.find((i) => isActive(pathname, i)) ?? items[0]!;
  const CurrentIcon = ICONS[current.key];
  const openTotal = items.reduce((s, i) => s + (i.count ?? 0), 0);
  return (
    <Dialog
      variant="sheet"
      title={shopName}
      description="Shop sections"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium"
          aria-label={`Section: ${current.label}. Open shop menu`}
        >
          <CurrentIcon className="size-4 text-muted" aria-hidden />
          <span className="truncate">{current.label}</span>
          {openTotal > 0 && current.key !== "enquiries" && (
            <span className="rounded-full bg-warning-soft px-1.5 text-xs font-semibold text-warning-soft-fg">{openTotal} open</span>
          )}
          <Menu className="ml-auto size-4 text-muted" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div onClick={(e) => (e.target as HTMLElement).closest("a") && close()}>
          <SidebarNav items={items} />
        </div>
      )}
    </Dialog>
  );
}
