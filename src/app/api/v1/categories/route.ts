import { z } from "zod";
import { api, ok, searchParamsObject } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { listCategories } from "@/modules/catalog/service";

/** GET /api/v1/categories?scope=product|shop — active categories. Public. */
export const GET = api(async ({ req }) => {
  const scope = parseInput(z.enum(["product", "shop"]).optional(), searchParamsObject(req).scope || undefined);
  const rows = await listCategories({ scope });
  return ok(
    rows.map((c) => ({ id: c.id, slug: c.slug, name: c.name, parentId: c.parentId, icon: c.icon, scope: c.scope, sortOrder: c.sortOrder })),
  );
});
