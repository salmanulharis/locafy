"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, Search, User } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  { href: "/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/search") },
  { href: "/saved", label: "Saved", icon: Heart, match: (p: string) => p.startsWith("/saved") },
  { href: "/account", label: "Account", icon: User, match: (p: string) => p.startsWith("/account") || p === "/login" || p === "/register" },
];

/** Primary customer navigation on small screens. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-safe backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium", active ? "text-primary" : "text-muted")}
              >
                <Icon className={cn("size-5", active && "stroke-[2.4]")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
