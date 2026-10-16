import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { reports, REPORT_TARGETS } from "@/db/schema";
import { parseInput, uuidSchema } from "@/lib/validation";
import { requireUser } from "@/modules/access/permissions";
import type { Ctx } from "@/modules/auth/context";
import { enforceRateLimit } from "@/modules/platform/rate-limit";

export const REPORT_REASONS = {
  incorrect_info: "Incorrect product or price information",
  out_of_stock: "Marked available but out of stock",
  closed: "Shop closed or does not exist",
  prohibited: "Prohibited or unsafe item",
  offensive: "Offensive or inappropriate content",
  spam: "Spam or misleading",
  duplicate: "Duplicate listing",
  other: "Something else",
} as const;

const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: uuidSchema,
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...(keyof typeof REPORT_REASONS)[]]),
  details: z.string().trim().max(1000).optional(),
});

/**
 * File a report. One open report per user per target; repeated submissions are
 * merged into the existing open report rather than creating duplicates.
 */
export async function createReport(ctx: Ctx, input: unknown) {
  const user = requireUser(ctx);
  const data = parseInput(reportSchema, input);
  await enforceRateLimit("reportCreate", user.id);
  const db = getDb();
  const existing = await db.query.reports.findFirst({
    where: and(
      eq(reports.reporterId, user.id),
      eq(reports.targetType, data.targetType),
      eq(reports.targetId, data.targetId),
      eq(reports.status, "open"),
    ),
  });
  if (existing) {
    await db
      .update(reports)
      .set({ reason: data.reason, details: data.details ?? existing.details })
      .where(eq(reports.id, existing.id));
    return { id: existing.id, duplicate: true };
  }
  const [r] = await db
    .insert(reports)
    .values({ reporterId: user.id, targetType: data.targetType, targetId: data.targetId, reason: data.reason, details: data.details ?? null })
    .returning({ id: reports.id });
  return { id: r!.id, duplicate: false };
}
