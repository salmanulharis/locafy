import { api } from "@/lib/http";
import * as auth from "@/modules/auth/service";
import { done } from "../../_lib/helpers";

/** POST /api/v1/me/deletion-request — ask for the account to be deleted (completed by an administrator). */
export const POST = api(async ({ ctx }) => {
  await auth.requestAccountDeletion(ctx);
  return done({ status: 202 });
});

/** DELETE /api/v1/me/deletion-request — withdraw a pending deletion request. */
export const DELETE = api(async ({ ctx }) => {
  await auth.cancelAccountDeletion(ctx);
  return done();
});
