import { api, ok, searchParamsObject } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { latLngSchema } from "@/modules/geo/geo";
import { nearestLocalityName } from "@/modules/geo/locations";

/** GET /api/v1/locations/reverse?lat=&lng= — nearest known locality name (no external call). Public. */
export const GET = api(async ({ req }) => {
  const p = parseInput(latLngSchema, searchParamsObject(req));
  return ok({ label: await nearestLocalityName(p) });
});
