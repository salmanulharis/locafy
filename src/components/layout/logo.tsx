import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path d="M16 7.5c-3.9 0-7 3.03-7 6.78 0 4.9 7 10.22 7 10.22s7-5.32 7-10.22c0-3.75-3.1-6.78-7-6.78Z" fill="var(--primary-fg)" />
      <circle cx="16" cy="14.3" r="2.6" fill="var(--primary)" />
    </svg>
  );
}

export function Logo({ href = "/", suffix }: { href?: string; suffix?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight text-strong" aria-label={`Locafy${suffix ? ` ${suffix}` : ""} home`}>
      <LogoMark />
      <span className="text-lg">Locafy</span>
      {suffix && <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted">{suffix}</span>}
    </Link>
  );
}
