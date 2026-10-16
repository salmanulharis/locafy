"use server";

import type { ActionState } from "@/lib/actions";
import { replyToEnquiry, setEnquiryClosed } from "@/modules/enquiries/service";
import { createReport } from "@/modules/reports/service";
import { merchantAction, str, type MerchantActionData } from "../../_lib/action";

type State = Promise<ActionState<MerchantActionData>>;

export async function replyAction(enquiryId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction((ctx) => replyToEnquiry(ctx, enquiryId, { body: str(fd, "body") }), "Reply sent");
}

export async function setClosedAction(enquiryId: string, closed: boolean, _prev: ActionState, _fd: FormData): State {
  void _fd;
  return merchantAction((ctx) => setEnquiryClosed(ctx, enquiryId, closed), closed ? "Enquiry closed" : "Enquiry reopened");
}

export async function reportEnquiryAction(enquiryId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction(
    (ctx) => createReport(ctx, { targetType: "enquiry", targetId: enquiryId, reason: str(fd, "reason"), details: str(fd, "details") }).then(() => undefined),
    "Thanks — our moderators will review this enquiry",
  );
}
