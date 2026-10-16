import { api, ok, searchParamsObject } from "@/lib/http";
import { searchPlaces } from "@/modules/geo/locations";

/** GET /api/v1/locations/search?q= — town, locality, landmark or postal code. Public. */
export const GET = api(async ({ req, ctx }) => ok(await searchPlaces(ctx, searchParamsObject(req))));
