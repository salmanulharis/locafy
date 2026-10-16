"use server";

import { runAction, type ActionState } from "@/lib/actions";
import { errors } from "@/lib/errors";
import { formDataToObject } from "@/lib/validation";
import * as admin from "@/modules/administration/service";

// Thin transport layer: parse FormData, call the administration service.
// Every service re-checks requireAdmin / requireSuperAdmin.

type Prev = ActionState;

// ---- Shops -----------------------------------------------------------------

export async function approveShopAction(shopId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.decideShop(ctx, shopId, "approve", formDataToObject(fd)), "Shop approved");
}
export async function rejectShopAction(shopId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.decideShop(ctx, shopId, "reject", formDataToObject(fd)), "Shop rejected");
}
export async function suspendShopAction(shopId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.decideShop(ctx, shopId, "suspend", formDataToObject(fd)), "Shop suspended");
}
export async function reactivateShopAction(shopId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.decideShop(ctx, shopId, "reactivate", formDataToObject(fd)), "Shop reactivated");
}
export async function setShopVerifiedAction(shopId: string, verified: boolean) {
  return runAction((ctx) => admin.setShopVerified(ctx, shopId, verified), verified ? "Shop marked as verified" : "Verification removed");
}
export async function correctShopInfoAction(shopId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.correctShopInfo(ctx, shopId, formDataToObject(fd)), "Shop details saved");
}
export async function assignPlanAction(shopId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.assignPlan(ctx, shopId, formDataToObject(fd)), "Plan assigned");
}

// ---- Users -----------------------------------------------------------------

export async function suspendUserAction(userId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.suspendUser(ctx, userId, formDataToObject(fd)), "Account suspended");
}
export async function reactivateUserAction(userId: string) {
  return runAction((ctx) => admin.reactivateUser(ctx, userId), "Account reactivated");
}
export async function processDeletionAction(userId: string, _p: Prev, fd: FormData) {
  return runAction(async (ctx) => {
    if (fd.get("confirm") !== "DELETE") throw errors.validation("Type DELETE to confirm.", { confirm: ["Type DELETE to confirm."] });
    await admin.processAccountDeletion(ctx, userId);
  }, "Account deleted and anonymised");
}
export async function setPlatformRoleAction(userId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.setPlatformRole(ctx, userId, formDataToObject(fd)), "Platform role updated");
}

// ---- Catalogue -------------------------------------------------------------

function catalogInputFromForm(fd: FormData) {
  const base = formDataToObject(fd);
  const keys = fd.getAll("specKey[]").map((v) => String(v).trim());
  const values = fd.getAll("specValue[]").map((v) => String(v).trim());
  const specs: Record<string, string> = {};
  keys.forEach((k, i) => {
    const v = values[i] ?? "";
    if (k && v) specs[k] = v;
  });
  const aliases = String(fd.get("aliases") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  delete base.specKey;
  delete base.specValue;
  return { ...base, specs, aliases: [...new Set(aliases)] };
}

export async function updateCatalogAction(productId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.adminUpdateCatalogProduct(ctx, productId, catalogInputFromForm(fd)), "Product saved");
}
export async function setCatalogRestrictedAction(productId: string, restricted: boolean, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.setCatalogRestricted(ctx, productId, restricted, formDataToObject(fd)), restricted ? "Product restricted" : "Restriction lifted");
}
export async function mergeCatalogAction(sourceId: string, _p: Prev, fd: FormData) {
  return runAction(
    (ctx) => admin.mergeCatalogProducts(ctx, { sourceId, targetId: String(fd.get("targetId") ?? "").trim() }),
    "Products merged",
  );
}
export async function setListingRestrictedAction(listingId: string, restricted: boolean, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.setListingRestricted(ctx, listingId, restricted, formDataToObject(fd)), restricted ? "Listing restricted" : "Listing restriction lifted");
}

// ---- Taxonomy & search -----------------------------------------------------

export async function saveCategoryAction(categoryId: string | null, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.saveCategory(ctx, categoryId, formDataToObject(fd)), categoryId ? "Category saved" : "Category created");
}
export async function setBrandAliasesAction(brandId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.setBrandAliases(ctx, brandId, { aliases: String(fd.get("aliases") ?? "") }), "Brand aliases saved");
}
export async function saveSynonymAction(_p: Prev, fd: FormData) {
  return runAction((ctx) => admin.saveSynonym(ctx, { term: String(fd.get("term") ?? ""), synonyms: String(fd.get("synonyms") ?? "") }), "Synonyms saved");
}
export async function deleteSynonymAction(id: string) {
  return runAction((ctx) => admin.deleteSynonym(ctx, id), "Synonym deleted");
}

// ---- Moderation ------------------------------------------------------------

export async function setReviewStatusAction(reviewId: string, status: "published" | "hidden" | "removed", _p: Prev, fd: FormData) {
  const msg = status === "published" ? "Review restored" : status === "hidden" ? "Review hidden" : "Review removed";
  return runAction((ctx) => admin.setReviewStatus(ctx, reviewId, status, formDataToObject(fd)), msg);
}
export async function forceUnpublishOfferAction(offerId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.forceUnpublishOffer(ctx, offerId, formDataToObject(fd)), "Offer unpublished");
}
export async function resolveReportAction(reportId: string, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.resolveReport(ctx, reportId, formDataToObject(fd)), "Report resolved");
}

// ---- Plans & sponsored -----------------------------------------------------

export async function savePlanAction(planId: string | null, _p: Prev, fd: FormData) {
  return runAction((ctx) => admin.savePlan(ctx, planId, formDataToObject(fd)), planId ? "Plan saved" : "Plan created");
}
export async function createSponsoredAction(_p: Prev, fd: FormData) {
  return runAction((ctx) => admin.createSponsoredPlacement(ctx, formDataToObject(fd)), "Sponsored placement created");
}
export async function deactivateSponsoredAction(id: string) {
  return runAction((ctx) => admin.deactivateSponsoredPlacement(ctx, id), "Placement deactivated");
}
