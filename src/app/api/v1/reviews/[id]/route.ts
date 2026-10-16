import { api } from "@/lib/http";
import { deleteReview } from "@/modules/reviews/service";
import { done, pathId } from "../../_lib/helpers";

/** DELETE /api/v1/reviews/{id} — delete your own review. */
export const DELETE = api<{ id: string }>(async ({ ctx, params }) => {
  await deleteReview(ctx, pathId(params.id, "Review"));
  return done();
});
