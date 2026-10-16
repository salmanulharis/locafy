import { FileWarning } from "lucide-react";
import { DASH, formatDateTime } from "@/components/admin/format";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { listErrorLogs } from "@/modules/administration/service";
import { adminCtx } from "../_lib/guard";

export const metadata = { title: "Errors" };

export default async function AdminErrorsPage() {
  const ctx = await adminCtx("/admin/errors");
  const rows = await listErrorLogs(ctx);

  return (
    <>
      <PageHeader title="Errors" description="Unexpected server errors (latest 100). Users only ever see a generic message and the request ID." />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<FileWarning className="size-5" aria-hidden />} title="No errors recorded" description="Nothing has gone wrong recently." />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((e) => (
            <li key={e.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 font-medium break-words">{e.message}</p>
                  <time className="text-xs whitespace-nowrap text-muted">{formatDateTime(e.createdAt)}</time>
                </div>
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="inline text-muted">Route: </dt>
                    <dd className="inline font-mono break-all">{e.route ?? DASH}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline text-muted">Request ID: </dt>
                    <dd className="inline font-mono break-all select-all">{e.requestId ?? DASH}</dd>
                  </div>
                </dl>
                {e.stack && (
                  <details className="mt-2">
                    <summary className="flex min-h-11 cursor-pointer items-center text-sm text-muted">Stack trace</summary>
                    <pre className="max-h-80 overflow-auto rounded-lg bg-surface-2 p-3 text-xs whitespace-pre">{e.stack}</pre>
                  </details>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
