import { api, readJson } from "@/lib/http";
import { replyToEnquiry } from "@/modules/enquiries/service";
import { created, done, pathId } from "../../../_lib/helpers";

/** POST /api/v1/enquiries/{id}/messages — { body }. Customer or shop team member. */
export const POST = api<{ id: string }>(async ({ req, ctx, params }) => {
  await replyToEnquiry(ctx, pathId(params.id, "Enquiry"), await readJson(req));
  return done(created);
});
