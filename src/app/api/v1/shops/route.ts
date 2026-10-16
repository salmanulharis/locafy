import { z } from "zod";
import { api, ok, searchParamsObject } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { nearbyShops } from "@/modules/discovery/service";
import { locationQuery } from "../_lib/helpers";

const query = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** GET /api/v1/shops?lat=&lng=&radiusKm=&q=&category=&limit= — active shops, nearest first. Public. */
export const GET = api(async ({ req }) => {
  const sp = searchParamsObject(req);
  const { point, radiusKm } = locationQuery(sp);
  const { q, category, limit } = parseInput(query, { q: sp.q || undefined, category: sp.category || undefined, limit: sp.limit || undefined });
  const items = await nearbyShops(point, radiusKm, { q, category, limit });
  return ok(items, { hasLocation: Boolean(point), radiusKm, total: items.length });
});
