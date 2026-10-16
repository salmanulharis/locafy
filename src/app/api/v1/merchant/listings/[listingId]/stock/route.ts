import { api, ok, readJson } from "@/lib/http";
import { addBranchInventory } from "@/modules/inventory/service";
import { created, pathId } from "../../../../_lib/helpers";

/** POST /api/v1/merchant/listings/{listingId}/stock — { branchId, price, quantity?, stockStatus? }: start stocking at another branch. */
export const POST = api<{ listingId: string }>(async ({ req, ctx, params }) =>
  ok(await addBranchInventory(ctx, pathId(params.listingId, "Listing"), await readJson(req)), undefined, created),
);
