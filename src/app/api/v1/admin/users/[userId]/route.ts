import { api, ok } from "@/lib/http";
import { getUser } from "@/modules/administration/service";
import { pathId } from "../../../_lib/helpers";

/** GET /api/v1/admin/users/{userId} — account (no password hash), memberships, audit history (admin). */
export const GET = api<{ userId: string }>(async ({ ctx, params }) => ok(await getUser(ctx, pathId(params.userId, "User"))));
