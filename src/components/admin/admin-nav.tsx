"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  FileWarning,
  Flag,
  FolderTree,
  LayoutDashboard,
  Menu,
  Megaphone,
  Package,
  ScrollText,
  Star,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/cn";

type Counts = { pendingShops: number; openReports: number };

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/shops", label: "Shops", icon: Store, count: "pendingShops" as const, countLabel: "pending" },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/catalogue", label: "Catalogue", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/brands", label: "Brands & synonyms", icon: Tags },
  { href: "/admin/reports", label: "Reports", icon: Flag, count: "openReports" as const, countLabel: "open" },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/plans", label: "Plans & subscriptions", icon: CreditCard },
  { href: "/admin/sponsored", label: "Sponsored", icon: Megaphone },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/errors", label: "Errors", icon: FileWarning },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ counts, onNavigate }: { counts: Counts; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.count ? counts[item.count] : 0;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                active ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-soft-fg tabular">
                  {count}
                  <span className="sr-only"> {item.countLabel}</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebar({ counts }: { counts: Counts }) {
  return (
    <nav aria-label="Administration" className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto py-6 pr-4 lg:block">
      <NavLinks counts={counts} />
    </nav>
  );
}

export function AdminMobileNav({ counts }: { counts: Counts }) {
  const pathname = usePathname();
  const current = NAV.find((n) => isActive(pathname, n.href));
  const attention = counts.pendingShops + counts.openReports;
  return (
    <Dialog
      variant="sheet"
      title="Administration"
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="flex h-11 items-center min-w-11 justify-center gap-2 rounded-lg border border-border-strong px-2.5 text-sm font-medium lg:hidden"
          aria-label={`Open admin menu${attention ? ` (${attention} items need attention)` : ""}`}
        >
          <Menu className="size-4" aria-hidden />
          <span className="hidden max-w-[8rem] truncate min-[420px]:inline">{current?.label ?? "Menu"}</span>
          {attention > 0 && <span className="rounded-full bg-warning-soft px-1.5 text-xs font-semibold text-warning-soft-fg">{attention}</span>}
        </button>
      )}
    >
      {(close) => (
        <nav aria-label="Administration">
          <NavLinks counts={counts} onNavigate={close} />
        </nav>
      )}
    </Dialog>
  );
}
