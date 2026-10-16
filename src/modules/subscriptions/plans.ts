import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { plans } from "@/db/schema";
import { mergeEntitlements } from "./entitlements";

/** Active plans for public display (no subscriber data). */
export async function listPublicPlans() {
  const rows = await getDb().select().from(plans).where(eq(plans.isActive, true)).orderBy(asc(plans.sortOrder));
  return rows.map((p) => ({ ...p, entitlements: mergeEntitlements(p.entitlements) }));
}
