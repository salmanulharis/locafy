import { api } from "@/lib/http";
import { setEnquiryClosed } from "@/modules/enquiries/service";
import { done, pathId } from "../../../_lib/helpers";

/** POST /api/v1/enquiries/{id}/close — customer or shop team member. */
export const POST = api<{ id: string }>(async ({ ctx, params }) => {
  await setEnquiryClosed(ctx, pathId(params.id, "Enquiry"), true);
  return done();
});
