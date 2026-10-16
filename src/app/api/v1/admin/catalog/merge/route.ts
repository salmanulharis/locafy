import { api, readJson } from "@/lib/http";
import { mergeCatalogProducts } from "@/modules/administration/service";
import { done } from "../../../_lib/helpers";

/** POST /api/v1/admin/catalog/merge — { sourceId, targetId }: merge a duplicate into the canonical product (admin). */
export const POST = api(async ({ req, ctx }) => {
  await mergeCatalogProducts(ctx, await readJson(req));
  return done();
});
