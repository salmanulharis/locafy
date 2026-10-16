"use server";

import type { ActionState } from "@/lib/actions";
import { respondToReview } from "@/modules/reviews/service";
import { merchantAction, str, type MerchantActionData } from "../../_lib/action";

export async function respondAction(reviewId: string, _prev: ActionState, fd: FormData): Promise<ActionState<MerchantActionData>> {
  return merchantAction((ctx) => respondToReview(ctx, reviewId, { response: str(fd, "response") }), "Response published");
}
