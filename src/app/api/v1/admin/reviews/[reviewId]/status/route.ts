import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { setReviewStatus } from "@/modules/administration/service";
import { done, pathId } from "../../../../_lib/helpers";

const bodySchema = z.object({ status: z.enum(["published", "hidden", "removed"]) });

/** POST /api/v1/admin/reviews/{reviewId}/status — { status: published|hidden|removed, reason? } (reason required unless published). */
export const POST = api<{ reviewId: string }>(async ({ req, ctx, params }) => {
  const body = await readJson(req);
  const { status } = parseInput(bodySchema, body);
  await setReviewStatus(ctx, pathId(params.reviewId, "Review"), status, body);
  return done();
});
