import { ScrollText } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { formatDateTime } from "./format";

export type AuditEntry = {
  id: number;
  action: string;
  createdAt: Date | string;
  metadata?: Record<string, unknown> | null;
  actorName?: string | null;
};

function metaSummary(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  if (typeof meta.reason === "string") return `Reason: ${meta.reason}`;
  const parts = Object.entries(meta)
    .filter(([, v]) => v != null && (typeof v !== "object" || Array.isArray(v)))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Compact timeline of audit entries. */
export function AuditList({ entries, emptyText = "No recorded history yet." }: { entries: AuditEntry[]; emptyText?: string }) {
  if (!entries.length) return <EmptyState icon={<ScrollText className="size-5" aria-hidden />} title="No history" description={emptyText} className="py-6" />;
  return (
    <ol className="flex flex-col divide-y divide-border">
      {entries.map((e) => {
        const summary = metaSummary(e.metadata);
        return (
          <li key={e.id} className="flex flex-col gap-0.5 py-2.5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <code className="font-mono text-xs break-all">{e.action}</code>
              <time className="text-xs text-muted">{formatDateTime(e.createdAt)}</time>
            </div>
            {e.actorName && <p className="text-xs text-muted">by {e.actorName}</p>}
            {summary && <p className="text-muted break-words">{summary}</p>}
          </li>
        );
      })}
    </ol>
  );
}
