import { describe, expect, it } from "vitest";
import { nextEnquiryStatus, type EnquiryEvent, type EnquiryStatus } from "@/modules/enquiries/rules";
import {
  allowedActions,
  COUNTED_STATUSES,
  nextListingStatus,
  publishBlockers,
  type ListingAction,
  type ListingStatus,
} from "@/modules/listings/rules";

describe("listing transitions", () => {
  const cases: [ListingStatus, ListingAction, ListingStatus | null][] = [
    ["draft", "publish", "published"],
    ["draft", "archive", "archived"],
    ["draft", "unpublish", null],
    ["draft", "restore", null],
    ["published", "unpublish", "unpublished"],
    ["published", "archive", "archived"],
    ["published", "discontinue", "discontinued"],
    ["published", "publish", null],
    ["unpublished", "publish", "published"],
    ["unpublished", "discontinue", "discontinued"],
    ["discontinued", "restore", "draft"],
    ["discontinued", "publish", null],
    ["archived", "restore", "draft"],
    ["archived", "publish", null],
    ["archived", "unpublish", null],
    ["restricted", "publish", null],
    ["restricted", "restore", null],
    ["restricted", "archive", null],
  ];
  it.each(cases)("%s --%s--> %s", (from, action, to) => {
    expect(nextListingStatus(from, action)).toBe(to);
  });

  it("allowedActions matches the transition table", () => {
    expect(allowedActions("restricted")).toEqual([]);
    expect(allowedActions("archived")).toEqual(["restore"]);
    expect(new Set(allowedActions("published"))).toEqual(new Set(["unpublish", "archive", "discontinue"]));
  });

  it("archived/discontinued/restricted do not count towards the plan limit", () => {
    expect(COUNTED_STATUSES).toEqual(["draft", "published", "unpublished"]);
  });
});

describe("publishBlockers", () => {
  const ok = { shopStatus: "active", catalogStatus: "active", listingStatus: "draft" as ListingStatus, pricedLocatedBranches: 1 };

  it("no blockers when everything is in place", () => {
    expect(publishBlockers(ok)).toEqual([]);
  });

  it.each(["draft", "pending", "rejected", "suspended"])("blocks when shop is %s", (shopStatus) => {
    expect(publishBlockers({ ...ok, shopStatus })).toEqual(["Your shop must be approved before products can be published."]);
  });

  it("blocks restricted catalogue products and listings", () => {
    expect(publishBlockers({ ...ok, catalogStatus: "restricted" })).toHaveLength(1);
    expect(publishBlockers({ ...ok, listingStatus: "restricted" })[0]).toMatch(/restricted by a moderator/);
  });

  it("requires a priced branch with a location", () => {
    expect(publishBlockers({ ...ok, pricedLocatedBranches: 0 })[0]).toMatch(/map location/);
  });

  it("reports every blocker at once", () => {
    expect(publishBlockers({ shopStatus: "draft", catalogStatus: "restricted", listingStatus: "restricted", pricedLocatedBranches: 0 })).toHaveLength(4);
  });
});

describe("enquiry state machine", () => {
  const table: [EnquiryStatus, EnquiryEvent, EnquiryStatus | null][] = [
    ["open", "merchant_reply", "responded"],
    ["open", "customer_reply", "open"],
    ["open", "close", "closed"],
    ["open", "reopen", null],
    ["responded", "merchant_reply", "responded"],
    ["responded", "customer_reply", "open"],
    ["responded", "close", "closed"],
    ["responded", "reopen", null],
    ["closed", "merchant_reply", null],
    ["closed", "customer_reply", null],
    ["closed", "close", null],
    ["closed", "reopen", "open"],
  ];
  it.each(table)("%s --%s--> %s", (from, ev, to) => {
    expect(nextEnquiryStatus(from, ev)).toBe(to);
  });
});
