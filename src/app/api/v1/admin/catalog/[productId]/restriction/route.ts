import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { setCatalogRestricted } from "@/modules/administration/service";
import { done, pathId } from "../../../../_lib/helpers";

const bodySchema = z.object({ restricted: z.boolean() });

/** POST /api/v1/admin/catalog/{productId}/restriction — { restricted: boolean, reason? } (reason required when restricting). */
export const POST = api<{ productId: string }>(async ({ req, ctx, params }) => {
  const body = await readJson(req);
  const { restricted } = parseInput(bodySchema, body);
  await setCatalogRestricted(ctx, pathId(params.productId, "Product"), restricted, body);
  return done();
});
