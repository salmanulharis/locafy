import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function Section({ title, href, linkLabel = "See all", children, description }: { title: string; href?: string; linkLabel?: string; children: ReactNode; description?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-heading font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary hover:underline">
            {linkLabel}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Horizontal scroller that bleeds to the screen edge on mobile. */
export function Rail({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="list" aria-label={label} className="scrollbar-none -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [&>*]:snap-start">
      {children}
    </div>
  );
}
