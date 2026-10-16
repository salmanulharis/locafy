import { api, ok, searchParamsObject } from "@/lib/http";
import { suggest } from "@/modules/search/service";

/** GET /api/v1/search/suggest?q= — product and category suggestions. Public. */
export const GET = api(async ({ req }) => ok(await suggest(searchParamsObject(req).q ?? "")));
