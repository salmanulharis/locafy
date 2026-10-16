/** Listing lifecycle rules (pure, unit-tested). */

export type ListingStatus = "draft" | "published" | "unpublished" | "archived" | "discontinued" | "restricted";
export type ListingAction = "publish" | "unpublish" | "archive" | "discontinue" | "restore";

const TRANSITIONS: Record<ListingStatus, Partial<Record<ListingAction, ListingStatus>>> = {
  draft: { publish: "published", archive: "archived" },
  published: { unpublish: "unpublished", archive: "archived", discontinue: "discontinued" },
  unpublished: { publish: "published", archive: "archived", discontinue: "discontinued" },
  discontinued: { archive: "archived", restore: "draft" },
  archived: { restore: "draft" },
  // Only administrators lift restrictions (administration module).
  restricted: {},
};

export function nextListingStatus(current: ListingStatus, action: ListingAction): ListingStatus | null {
  return TRANSITIONS[current][action] ?? null;
}

export function allowedActions(current: ListingStatus): ListingAction[] {
  return Object.keys(TRANSITIONS[current]) as ListingAction[];
}

/** Statuses that count towards the plan's listing limit. */
export const COUNTED_STATUSES: ListingStatus[] = ["draft", "published", "unpublished"];

export type PublishCheckInput = {
  shopStatus: string;
  catalogStatus: string;
  listingStatus: ListingStatus;
  pricedLocatedBranches: number;
};

/** Reasons a listing cannot be published; empty array means publishable. */
export function publishBlockers(i: PublishCheckInput): string[] {
  const out: string[] = [];
  if (i.shopStatus !== "active") out.push("Your shop must be approved before products can be published.");
  if (i.catalogStatus !== "active") out.push("This product is restricted on Locafy.");
  if (i.listingStatus === "restricted") out.push("This listing has been restricted by a moderator.");
  if (i.pricedLocatedBranches < 1) out.push("Add a price for at least one branch with a map location.");
  return out;
}

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
  discontinued: "Discontinued",
  restricted: "Restricted",
};
