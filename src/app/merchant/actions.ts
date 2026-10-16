"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { formDataToObject } from "@/lib/validation";
import { createShop } from "@/modules/shops/service";
import { merchantAction, type MerchantActionData } from "./_lib/action";

export async function createShopAction(_prev: ActionState, fd: FormData): Promise<ActionState<MerchantActionData>> {
  let id: string | undefined;
  const state = await merchantAction(async (ctx) => {
    const shop = await createShop(ctx, formDataToObject(fd));
    id = shop.id;
  });
  if (state.ok && id) redirect(`/merchant/${id}/onboarding?step=2&created=1`);
  return state;
}
