import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Render this cell as the card title on mobile (no label). */
  mobileTitle?: boolean;
  /** Omit from the mobile card. */
  hideOnMobile?: boolean;
};

/**
 * Data-dense table on desktop, stacked cards on small screens so the page
 * never scrolls horizontally.
 */
export function DataTable<T>({ rows, columns, rowKey, caption }: { rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; caption: string }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cn("px-4 py-2.5 font-medium", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={rowKey(r)} className="align-top">
                {columns.map((c) => (
                  <td key={c.header} className={cn("px-4 py-3", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-xl border border-border bg-surface p-4">
            <dl className="flex flex-col gap-2 text-sm">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((c) =>
                  c.mobileTitle ? (
                    <div key={c.header} className="min-w-0 break-words">
                      <dt className="sr-only">{c.header}</dt>
                      <dd>{c.cell(r)}</dd>
                    </div>
                  ) : (
                    <div key={c.header} className="flex min-w-0 items-start justify-between gap-3">
                      <dt className="shrink-0 text-muted">{c.header}</dt>
                      <dd className="min-w-0 text-right break-words">{c.cell(r)}</dd>
                    </div>
                  ),
                )}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
