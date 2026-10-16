import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function Panel({ title, description, actions, children, className, id }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  const headingId = id ?? `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Card className={cn("min-w-0 p-4 md:p-5", className)}>
      <section aria-labelledby={headingId}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id={headingId} className="text-heading font-semibold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
        {children}
      </section>
    </Card>
  );
}

export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-muted">{i.label}</dt>
          <dd className="mt-0.5 break-words">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-fg">
      <ChevronLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}
