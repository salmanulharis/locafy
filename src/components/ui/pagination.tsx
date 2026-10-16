import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "./button";

/** Link-based pagination that preserves the other query parameters. */
export function Pagination({ page, pageSize, total, basePath, params }: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonClass("outline", "md")} rel="prev">
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted tabular">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonClass("outline", "md")} rel="next">
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
