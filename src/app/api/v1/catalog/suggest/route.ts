import { api, ok, searchParamsObject } from "@/lib/http";
import { requireUser } from "@/modules/access/permissions";
import { suggestCatalogProducts } from "@/modules/catalog/service";

/** GET /api/v1/catalog/suggest?q= — catalogue matches for the merchant product picker. Signed-in users only. */
export const GET = api(async ({ req, ctx }) => {
  requireUser(ctx);
  const q = (searchParamsObject(req).q ?? "").slice(0, 100);
  return ok(await suggestCatalogProducts(q, 8));
});
