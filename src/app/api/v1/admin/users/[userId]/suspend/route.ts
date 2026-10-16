import { api, readJson } from "@/lib/http";
import { suspendUser } from "@/modules/administration/service";
import { done, pathId } from "../../../../_lib/helpers";

/** POST /api/v1/admin/users/{userId}/suspend — { reason }. Revokes all of the user's sessions. */
export const POST = api<{ userId: string }>(async ({ req, ctx, params }) => {
  await suspendUser(ctx, pathId(params.userId, "User"), await readJson(req));
  return done();
});
