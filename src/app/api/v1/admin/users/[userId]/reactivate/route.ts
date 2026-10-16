import { api } from "@/lib/http";
import { reactivateUser } from "@/modules/administration/service";
import { done, pathId } from "../../../../_lib/helpers";

/** POST /api/v1/admin/users/{userId}/reactivate */
export const POST = api<{ userId: string }>(async ({ ctx, params }) => {
  await reactivateUser(ctx, pathId(params.userId, "User"));
  return done();
});
