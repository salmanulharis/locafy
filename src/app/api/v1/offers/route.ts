import { z } from "zod";
import { api, ok, searchParamsObject } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { listActiveOffers } from "@/modules/offers/service";
import { locationQuery } from "../_lib/helpers";

/** GET /api/v1/offers?lat=&lng=&radiusKm=&limit= — currently running offers, nearest first. Public. */
export const GET = api(async ({ req }) => {
  const sp = searchParamsObject(req);
  const { point, radiusKm } = locationQuery(sp);
  const limit = parseInput(z.coerce.number().int().min(1).max(50).default(20), sp.limit || undefined);
  const items = await listActiveOffers({ point, radiusKm, limit });
  return ok(items, { hasLocation: Boolean(point), radiusKm, total: items.length });
});
