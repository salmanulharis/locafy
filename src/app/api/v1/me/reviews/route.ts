import { api, ok } from "@/lib/http";
import { listMyReviews } from "@/modules/reviews/service";

/** GET /api/v1/me/reviews — the caller's own reviews (any moderation status). */
export const GET = api(async ({ ctx }) => ok(await listMyReviews(ctx)));
