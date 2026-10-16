import { api } from "@/lib/http";
import { removeMember } from "@/modules/shops/service";
import { done, pathId } from "../../../../../_lib/helpers";

/** DELETE /api/v1/merchant/shops/{shopId}/members/{userId} — owner; owners cannot be removed. */
export const DELETE = api<{ shopId: string; userId: string }>(async ({ ctx, params }) => {
  await removeMember(ctx, pathId(params.shopId, "Shop"), pathId(params.userId, "Member"));
  return done();
});
