"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { createOffer, setOfferPublished, updateOffer } from "@/modules/offers/service";
import { merchantAction, str, type MerchantActionData } from "../../_lib/action";

type State = Promise<ActionState<MerchantActionData>>;

/**
 * Offer times: the browser converts the datetime-local value to an ISO string
 * in its own time zone (hidden `startsAt` / `endsAt`). Without JavaScript only
 * the local value arrives and is interpreted as India Standard Time (+05:30).
 */
function readTime(fd: FormData, key: "startsAt" | "endsAt") {
  const iso = str(fd, key);
  if (iso) return iso;
  const local = str(fd, `${key}Local`);
  if (!local) return undefined;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00+05:30` : local;
}

function readOffer(fd: FormData) {
  return {
    title: str(fd, "title"),
    description: str(fd, "description"),
    conditions: str(fd, "conditions"),
    discountType: str(fd, "discountType"),
    discountValue: str(fd, "discountValue") ?? "",
    startsAt: readTime(fd, "startsAt"),
    endsAt: readTime(fd, "endsAt"),
    listingIds: fd.getAll("listingIds[]").map(String),
  };
}

export async function createOfferAction(shopId: string, _prev: ActionState, fd: FormData): State {
  let id: string | undefined;
  const state = await merchantAction(async (ctx) => {
    const offer = await createOffer(ctx, shopId, readOffer(fd), fd.get("publish") === "1");
    id = offer.id;
  });
  if (state.ok && id) redirect(`/merchant/${shopId}/offers/${id}?saved=1`);
  return state;
}

export async function updateOfferAction(offerId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction((ctx) => updateOffer(ctx, offerId, readOffer(fd)), "Offer saved");
}

export async function setOfferPublishedAction(offerId: string, published: boolean, _prev: ActionState, _fd: FormData): State {
  void _fd;
  return merchantAction((ctx) => setOfferPublished(ctx, offerId, published), published ? "Offer published" : "Offer unpublished");
}
