import { api, ok } from "@/lib/http";
import { getEnquiryThread } from "@/modules/enquiries/service";
import { pathId } from "../../_lib/helpers";

/** GET /api/v1/enquiries/{id} — the thread; visible to the customer and to the shop's team. */
export const GET = api<{ id: string }>(async ({ ctx, params }) => ok(await getEnquiryThread(ctx, pathId(params.id, "Enquiry"))));
