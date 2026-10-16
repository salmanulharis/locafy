import { getDb, type Tx } from "@/db/client";
import { auditLogs, errorLogs } from "@/db/schema";
import type { Ctx } from "@/modules/auth/context";

export type AuditEntry = {
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

/** Record a sensitive action. Call inside the same transaction as the change. */
export async function audit(tx: Tx, ctx: Ctx, entry: AuditEntry) {
  await tx.insert(auditLogs).values({
    actorId: ctx.actor?.id ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    ip: ctx.ip,
  });
}

/** Structured server error log. Never throws. */
export async function logError(err: unknown, info: { requestId?: string; route?: string }) {
  const e = err instanceof Error ? err : new Error(String(err));
  console.error(JSON.stringify({ level: "error", requestId: info.requestId, route: info.route, message: e.message }));
  try {
    await getDb()
      .insert(errorLogs)
      .values({
        requestId: info.requestId ?? null,
        route: info.route ?? null,
        message: e.message.slice(0, 2000),
        stack: e.stack?.slice(0, 8000) ?? null,
      });
  } catch {
    // Logging must never mask the original failure.
  }
}
