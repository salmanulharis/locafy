import { z } from "zod";
import { api, readJson } from "@/lib/http";
import { parseInput } from "@/lib/validation";
import { decideShop } from "@/modules/administration/service";
import { done, pathId } from "../../../../_lib/helpers";

const bodySchema = z.object({ decision: z.enum(["approve", "reject", "suspend", "reactivate"]) });

/** POST /api/v1/admin/shops/{shopId}/decision — { decision: approve|reject|suspend|reactivate, reason? } (reason required for reject/suspend). */
export const POST = api<{ shopId: string }>(async ({ req, ctx, params }) => {
  const body = await readJson(req);
  const { decision } = parseInput(bodySchema, body);
  await decideShop(ctx, pathId(params.shopId, "Shop"), decision, body);
  return done();
});
