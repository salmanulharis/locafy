import { api, ok, readJson } from "@/lib/http";
import { getMyPreferences, updateMyPreferences } from "@/modules/notifications/service";

/** GET /api/v1/notifications/preferences */
export const GET = api(async ({ ctx }) => ok(await getMyPreferences(ctx)));

/** PUT /api/v1/notifications/preferences — any subset of { emailEnquiries, emailReviews, emailShopStatus, emailMarketing } (booleans). */
export const PUT = api(async ({ req, ctx }) => ok(await updateMyPreferences(ctx, await readJson(req))));
