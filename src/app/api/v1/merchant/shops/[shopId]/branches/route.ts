import { api, ok, readJson } from "@/lib/http";
import { addBranch } from "@/modules/shops/service";
import { created, pathId } from "../../../../_lib/helpers";

/** POST /api/v1/merchant/shops/{shopId}/branches — same body as primary-branch. Subject to the plan's branch limit. */
export const POST = api<{ shopId: string }>(async ({ req, ctx, params }) =>
  ok(await addBranch(ctx, pathId(params.shopId, "Shop"), await readJson(req)), undefined, created),
);
