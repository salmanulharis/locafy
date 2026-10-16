"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/account", label: "Profile" },
  { href: "/account/enquiries", label: "Enquiries" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/saved", label: "Saved" },
  { href: "/account/settings", label: "Settings" },
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="scrollbar-none -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1 md:flex-col">
        {LINKS.map((l) => {
          const active = l.href === "/account" ? path === "/account" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-10 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap", active ? "bg-primary-soft text-primary-soft-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
