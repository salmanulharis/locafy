import { api } from "@/lib/http";
import { markAllRead } from "@/modules/notifications/service";
import { done } from "../../_lib/helpers";

/** POST /api/v1/notifications/read-all */
export const POST = api(async ({ ctx }) => {
  await markAllRead(ctx);
  return done();
});
