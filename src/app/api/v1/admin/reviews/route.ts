import { api, ok, searchParamsObject } from "@/lib/http";
import { listReviewsForModeration } from "@/modules/administration/service";

/** GET /api/v1/admin/reviews?status=published|hidden|removed — max 100, most-reported first (admin). */
export const GET = api(async ({ req, ctx }) => ok([...(await listReviewsForModeration(ctx, searchParamsObject(req)))]));
