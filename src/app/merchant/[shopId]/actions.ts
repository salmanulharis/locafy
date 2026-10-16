"use server";

import type { ActionState } from "@/lib/actions";
import { errors } from "@/lib/errors";
import { formDataToObject } from "@/lib/validation";
import { uploadShopImage } from "@/modules/media/service";
import { DAYS } from "@/modules/shops/schemas";
import {
  addMember,
  removeMember,
  savePrimaryBranch,
  submitVerification,
  updateShopBasics,
  updateShopContact,
  updateShopMedia,
} from "@/modules/shops/service";
import { merchantAction, str, type MerchantActionData } from "../_lib/action";

type State = Promise<ActionState<MerchantActionData>>;

export async function saveBasicsAction(shopId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction((ctx) => updateShopBasics(ctx, shopId, formDataToObject(fd)), "Shop details saved");
}

export async function saveAddressAction(shopId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction(async (ctx) => {
    const input = formDataToObject(fd);
    if (input.lat === undefined || input.lng === undefined) {
      throw errors.validation("Pick the shop location on the map.", { lat: ["Pick the shop location on the map."] });
    }
    await savePrimaryBranch(ctx, shopId, input);
  }, "Address saved");
}

/**
 * Opening hours arrive as per-day fields: hours.<day>.closed, hours.<day>.open,
 * hours.<day>.close and an optional second session (open2/close2).
 * A closed day is stored as an empty list; a day with no times is left unset.
 */
function buildOpeningHours(fd: FormData) {
  const hours: Record<string, { open: string; close: string }[]> = {};
  const errs: Record<string, string[]> = {};
  for (const day of DAYS) {
    if (fd.get(`hours.${day}.closed`)) {
      hours[day] = [];
      continue;
    }
    const slots: { open: string; close: string }[] = [];
    for (const suffix of ["", "2"]) {
      const open = str(fd, `hours.${day}.open${suffix}`);
      const close = str(fd, `hours.${day}.close${suffix}`);
      if (!open && !close) continue;
      if (!open || !close) {
        errs[`hours.${day}`] = ["Enter both opening and closing time, or mark the day closed."];
        continue;
      }
      if (open >= close) errs[`hours.${day}`] = ["Closing time must be after opening time."];
      slots.push({ open, close });
    }
    if (slots.length) hours[day] = slots.sort((a, b) => a.open.localeCompare(b.open));
  }
  if (Object.keys(errs).length) throw errors.validation("Check the opening hours.", errs);
  return hours;
}

export async function saveContactAction(shopId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction(async (ctx) => {
    const openingHours = buildOpeningHours(fd);
    await updateShopContact(ctx, shopId, {
      phone: str(fd, "phone"),
      whatsapp: str(fd, "whatsapp"),
      email: str(fd, "email"),
      website: str(fd, "website"),
      openingHours,
    });
  }, "Contact details and hours saved");
}

export async function uploadShopImageAction(shopId: string, purpose: "logo" | "cover", _prev: ActionState, fd: FormData): State {
  return merchantAction(async (ctx) => {
    const file = fd.get("file");
    await uploadShopImage(ctx, shopId, file instanceof Blob ? file : null, purpose);
  }, purpose === "logo" ? "Logo updated" : "Cover photo updated");
}

export async function removeShopImageAction(shopId: string, purpose: "logo" | "cover", _prev: ActionState, _fd: FormData): State {
  void _fd;
  return merchantAction(
    (ctx) => updateShopMedia(ctx, shopId, purpose === "logo" ? { logoUrl: null } : { coverUrl: null }),
    purpose === "logo" ? "Logo removed" : "Cover photo removed",
  );
}

export async function submitVerificationAction(shopId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction((ctx) => submitVerification(ctx, shopId, formDataToObject(fd)), "Submitted for review");
}

export async function addMemberAction(shopId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction((ctx) => addMember(ctx, shopId, formDataToObject(fd)), "Team member added");
}

export async function removeMemberAction(shopId: string, userId: string, _prev: ActionState, _fd: FormData): State {
  void _fd;
  return merchantAction((ctx) => removeMember(ctx, shopId, userId), "Team member removed");
}
