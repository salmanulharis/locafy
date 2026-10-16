import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/** Liveness + database readiness probe for load balancers and uptime monitors. */
export async function GET() {
  const started = Date.now();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok", latencyMs: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "degraded", db: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
