"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { runAction, type ActionState } from "@/lib/actions";
import { formDataToObject } from "@/lib/validation";
import { getCtx } from "@/modules/auth/context";
import * as auth from "@/modules/auth/service";
import { SESSION_COOKIE } from "@/modules/auth/sessions";
import { recordClientEvent } from "@/modules/analytics/service";
import { createEnquiry, replyToEnquiry, setEnquiryClosed } from "@/modules/enquiries/service";
import { setFavourite } from "@/modules/favourites/service";
import { markAllRead, updatePreferences } from "@/modules/notifications/service";
import { createReport } from "@/modules/reports/service";
import { deleteReview, upsertReview } from "@/modules/reviews/service";

/** Favourite toggle used by the optimistic client button. Returns the persisted state. */
export async function setFavouriteAction(kind: "product" | "shop", id: string, saved: boolean): Promise<ActionState<{ saved: boolean }>> {
  return runAction((ctx) => setFavourite(ctx, { kind, id, saved }));
}

export async function createEnquiryAction(_: ActionState, fd: FormData): Promise<ActionState<{ id: string }>> {
  return runAction(async (ctx) => {
    const e = await createEnquiry(ctx, formDataToObject(fd));
    return { id: e.id };
  }, "Enquiry sent. The shop will reply here and you'll be notified.");
}

export async function replyEnquiryAction(enquiryId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return runAction((ctx) => replyToEnquiry(ctx, enquiryId, formDataToObject(fd)));
}

export async function closeEnquiryAction(enquiryId: string, closed: boolean, _prev?: ActionState): Promise<ActionState> {
  return runAction((ctx) => setEnquiryClosed(ctx, enquiryId, closed), closed ? "Enquiry closed" : "Enquiry reopened");
}

export async function upsertReviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (ctx) => {
    const r = await upsertReview(ctx, formDataToObject(fd));
    return r;
  }, "Thanks — your review is published.");
}

export async function deleteReviewAction(reviewId: string, _: ActionState): Promise<ActionState> {
  return runAction((ctx) => deleteReview(ctx, reviewId), "Review deleted");
}

export async function reportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async (ctx) => {
    await createReport(ctx, formDataToObject(fd));
  }, "Thanks for the report. Our team will review it.");
}

export async function trackEventAction(input: { type: "contact_click" | "direction_request" | "offer_view"; shopId: string; listingId?: string }) {
  try {
    await recordClientEvent(await getCtx(), input);
  } catch {
    // analytics must never block the user
  }
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction((ctx) => auth.updateProfile(ctx, formDataToObject(fd)), "Profile updated");
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await runAction((ctx) => auth.changePassword(ctx, formDataToObject(fd)));
  if (result.ok) {
    (await cookies()).delete(SESSION_COOKIE);
    redirect("/login?reset=1");
  }
  return result;
}

export async function notificationPrefsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const o = formDataToObject(fd);
  return runAction(
    (ctx) =>
      updatePreferences(ctx, {
        emailEnquiries: o.emailEnquiries === "on",
        emailReviews: o.emailReviews === "on",
        emailShopStatus: o.emailShopStatus === "on",
        emailMarketing: o.emailMarketing === "on",
      }),
    "Notification preferences saved",
  );
}

export async function markNotificationsReadAction(): Promise<void> {
  await markAllRead(await getCtx());
}

export async function requestDeletionAction(_: ActionState): Promise<ActionState> {
  return runAction((ctx) => auth.requestAccountDeletion(ctx), "Deletion requested. Our team will complete it and email you.");
}

export async function cancelDeletionAction(_: ActionState): Promise<ActionState> {
  return runAction((ctx) => auth.cancelAccountDeletion(ctx), "Deletion request cancelled");
}
