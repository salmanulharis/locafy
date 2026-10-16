import { api, readJson } from "@/lib/http";
import { respondToReview } from "@/modules/reviews/service";
import { done, pathId } from "../../../../_lib/helpers";

/** POST /api/v1/merchant/reviews/{reviewId}/response — { response } (owner/manager of the reviewed shop). Replaces any earlier response. */
export const POST = api<{ reviewId: string }>(async ({ req, ctx, params }) => {
  await respondToReview(ctx, pathId(params.reviewId, "Review"), await readJson(req));
  return done();
});
