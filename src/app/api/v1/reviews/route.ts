import { api, ok, readJson } from "@/lib/http";
import { upsertReview } from "@/modules/reviews/service";

/** POST /api/v1/reviews — { targetType: shop|product, targetId, rating 1-5, body? }. Creates (201) or edits (200) your review. */
export const POST = api(async ({ req, ctx }) => {
  const r = await upsertReview(ctx, await readJson(req));
  return ok(r, undefined, { status: r.created ? 201 : 200 });
});
