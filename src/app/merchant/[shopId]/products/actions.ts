"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { errors } from "@/lib/errors";
import { updateInventory, addBranchInventory } from "@/modules/inventory/service";
import { changeListingStatus, createListing, removeListingImage, updateListing } from "@/modules/listings/service";
import type { ListingAction } from "@/modules/listings/rules";
import { uploadShopImage } from "@/modules/media/service";
import { merchantAction, str, type MerchantActionData } from "../../_lib/action";

type State = Promise<ActionState<MerchantActionData>>;

/** Catalogue fields arrive as product.<field>; specs as specKey[] / specValue[] rows; aliases comma-separated. */
function readProduct(fd: FormData) {
  const keys = fd.getAll("specKey[]").map(String);
  const values = fd.getAll("specValue[]").map(String);
  const specs: Record<string, string> = {};
  keys.forEach((k, i) => {
    const key = k.trim();
    const value = (values[i] ?? "").trim();
    if (key && value) specs[key] = value;
  });
  const aliases = (str(fd, "product.aliases") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  return {
    name: str(fd, "product.name"),
    brand: str(fd, "product.brand"),
    model: str(fd, "product.model"),
    variant: str(fd, "product.variant"),
    categoryId: str(fd, "product.categoryId"),
    description: str(fd, "product.description"),
    gtin: str(fd, "product.gtin"),
    specs,
    aliases,
  };
}

export async function createListingAction(shopId: string, _prev: ActionState, fd: FormData): State {
  let listingId: string | undefined;
  const publish = fd.get("publish") === "1";
  const state = await merchantAction(async (ctx) => {
    const catalogProductId = str(fd, "catalogProductId");
    const mode = str(fd, "mode");
    if (mode !== "existing" && mode !== "new") {
      throw errors.validation("Choose a product from the catalogue or add a new one.", {
        product: ["Choose a product from the catalogue, or add a new one."],
      });
    }
    const tracked = fd.get("stockMode") !== "status";
    const result = await createListing(ctx, shopId, {
      catalogProductId: mode === "existing" ? catalogProductId : undefined,
      product: mode === "existing" ? undefined : readProduct(fd),
      notes: str(fd, "notes"),
      publish,
      stock: [
        {
          branchId: str(fd, "stock.0.branchId"),
          price: str(fd, "stock.0.price"),
          mrp: str(fd, "stock.0.mrp"),
          quantity: tracked ? str(fd, "stock.0.quantity") : undefined,
          stockStatus: tracked ? undefined : str(fd, "stock.0.stockStatus"),
          lowStockThreshold: str(fd, "stock.0.lowStockThreshold"),
        },
      ],
    });
    listingId = result.id;
  });
  if (state.ok && listingId) redirect(`/merchant/${shopId}/products/${listingId}?created=${publish ? "published" : "draft"}`);
  return state;
}

export async function updateInventoryAction(inventoryId: string, version: number, _prev: ActionState, fd: FormData): State {
  return merchantAction(async (ctx) => {
    const quick = str(fd, "adjustQuick");
    const adjust = quick ?? str(fd, "adjust");
    const untrack = fd.get("untrackQuantity") === "on";
    const quantity = str(fd, "quantity");
    const r = await updateInventory(ctx, inventoryId, {
      price: str(fd, "price"),
      // An emptied MRP field clears the MRP.
      mrp: str(fd, "mrp") ?? null,
      quantity: untrack || adjust !== undefined ? undefined : quantity,
      adjust: untrack ? undefined : adjust,
      untrackQuantity: untrack || undefined,
      stockStatus: str(fd, "stockStatus"),
      lowStockThreshold: str(fd, "lowStockThreshold"),
      expectedVersion: version,
    });
    return { changed: r.changed };
  }, "Stock and price saved");
}

export async function confirmStockAction(inventoryId: string, version: number, _prev: ActionState, _fd: FormData): State {
  void _fd;
  return merchantAction((ctx) => updateInventory(ctx, inventoryId, { confirm: true, expectedVersion: version }).then(() => undefined), "Marked as still accurate");
}

export async function addBranchStockAction(listingId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction(
    (ctx) =>
      addBranchInventory(ctx, listingId, {
        branchId: str(fd, "branchId"),
        price: str(fd, "price"),
        quantity: str(fd, "quantity"),
        stockStatus: str(fd, "quantity") ? undefined : str(fd, "stockStatus"),
      }).then(() => undefined),
    "Branch stock added",
  );
}

const STATUS_MESSAGES: Record<ListingAction, string> = {
  publish: "Published — customers can now find this product",
  unpublish: "Unpublished — hidden from customers",
  archive: "Archived",
  discontinue: "Marked as discontinued",
  restore: "Restored as a draft",
};

export async function changeListingStatusAction(listingId: string, action: ListingAction, _prev: ActionState, _fd: FormData): State {
  void _fd;
  return merchantAction((ctx) => changeListingStatus(ctx, listingId, action), STATUS_MESSAGES[action]);
}

export async function updateListingAction(listingId: string, includeProduct: boolean, _prev: ActionState, fd: FormData): State {
  return merchantAction(
    (ctx) => updateListing(ctx, listingId, { notes: str(fd, "notes"), product: includeProduct ? readProduct(fd) : undefined }),
    "Product details saved",
  );
}

export async function uploadListingPhotoAction(shopId: string, listingId: string, _prev: ActionState, fd: FormData): State {
  return merchantAction(async (ctx) => {
    const file = fd.get("file");
    await uploadShopImage(ctx, shopId, file instanceof Blob ? file : null, "listing", listingId);
  }, "Photo added");
}

export async function removeListingPhotoAction(listingId: string, imageId: string, _prev: ActionState, _fd: FormData): State {
  void _fd;
  return merchantAction((ctx) => removeListingImage(ctx, listingId, imageId), "Photo removed");
}
