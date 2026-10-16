import { api, ok } from "@/lib/http";
import { overview } from "@/modules/administration/service";

/** GET /api/v1/admin/overview — platform counters (admin). */
export const GET = api(async ({ ctx }) => ok(await overview(ctx)));
