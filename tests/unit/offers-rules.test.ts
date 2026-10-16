import { describe, expect, it } from "vitest";
import { applyDiscount, describeOffer, offerPhase, validateDiscount, validateOfferWindow } from "@/modules/offers/rules";

const DAY = 86_400_000;

describe("applyDiscount", () => {
  it("percent", () => {
    expect(applyDiscount(1000, "percent", 10)).toBe(900);
    expect(applyDiscount(999, "percent", 33)).toBe(669);
    expect(applyDiscount(3_999_900, "percent", 5)).toBe(3_799_905);
  });

  it("amount_off", () => {
    expect(applyDiscount(1000, "amount_off", 250)).toBe(750);
  });

  it("fixed_price", () => {
    expect(applyDiscount(1000, "fixed_price", 799)).toBe(799);
  });

  it("never goes below 1 minor unit", () => {
    expect(applyDiscount(300, "amount_off", 500)).toBe(1);
    expect(applyDiscount(300, "amount_off", 300)).toBe(1);
    expect(applyDiscount(1, "percent", 95)).toBe(1);
    expect(applyDiscount(1000, "fixed_price", 0)).toBe(1);
    expect(applyDiscount(1000, "percent", 100)).toBe(1);
  });

  it("never raises the original price", () => {
    expect(applyDiscount(1000, "fixed_price", 2000)).toBe(1000);
    expect(applyDiscount(1000, "percent", -10)).toBe(1000);
    expect(applyDiscount(1000, "amount_off", -50)).toBe(1000);
    expect(applyDiscount(1000, "percent", 0)).toBe(1000);
  });

  it("always returns an integer", () => {
    for (const p of [1, 7, 99, 101, 12_345]) {
      for (const v of [1, 3, 33, 50, 95]) expect(Number.isInteger(applyDiscount(p, "percent", v))).toBe(true);
    }
  });
});

describe("offerPhase", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const startsAt = new Date(now.getTime() - DAY);
  const endsAt = new Date(now.getTime() + DAY);

  it("draft and unpublished win over dates", () => {
    expect(offerPhase({ status: "draft", startsAt, endsAt }, now)).toBe("draft");
    expect(offerPhase({ status: "unpublished", startsAt, endsAt }, now)).toBe("unpublished");
  });

  it("active / scheduled / expired", () => {
    expect(offerPhase({ status: "published", startsAt, endsAt }, now)).toBe("active");
    expect(offerPhase({ status: "published", startsAt: new Date(now.getTime() + 1000), endsAt }, now)).toBe("scheduled");
    expect(offerPhase({ status: "published", startsAt, endsAt: new Date(now.getTime() - 1000) }, now)).toBe("expired");
  });

  it("boundaries: start is inclusive, end is exclusive", () => {
    expect(offerPhase({ status: "published", startsAt: now, endsAt }, now)).toBe("active");
    expect(offerPhase({ status: "published", startsAt, endsAt: now }, now)).toBe("expired");
  });
});

describe("validateOfferWindow", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("accepts a normal future window", () => {
    expect(validateOfferWindow(now, new Date(now.getTime() + 7 * DAY), now)).toEqual([]);
  });

  it("accepts a scheduled window that has not started", () => {
    expect(validateOfferWindow(new Date(now.getTime() + DAY), new Date(now.getTime() + 2 * DAY), now)).toEqual([]);
  });

  it("rejects invalid dates", () => {
    const issues = validateOfferWindow(new Date("nope"), new Date("nope"), now);
    expect(issues.map((i) => i.field)).toEqual(["startsAt", "endsAt"]);
  });

  it("rejects end before start", () => {
    const issues = validateOfferWindow(new Date(now.getTime() + 2 * DAY), new Date(now.getTime() + DAY), now);
    expect(issues).toContainEqual({ field: "endsAt", message: "End must be after the start." });
  });

  it("rejects an already-expired window", () => {
    const issues = validateOfferWindow(new Date(now.getTime() - 3 * DAY), new Date(now.getTime() - DAY), now);
    expect(issues).toContainEqual({ field: "endsAt", message: "End must be in the future." });
  });

  it("rejects windows longer than a year", () => {
    expect(validateOfferWindow(now, new Date(now.getTime() + 366 * DAY), now)).toEqual([]);
    const issues = validateOfferWindow(now, new Date(now.getTime() + 367 * DAY), now);
    expect(issues.map((i) => i.message)).toContain("Offers can run for at most one year.");
  });
});

describe("validateDiscount", () => {
  it("requires a positive integer", () => {
    expect(validateDiscount("amount_off", 0)?.field).toBe("discountValue");
    expect(validateDiscount("amount_off", -1)).not.toBeNull();
    expect(validateDiscount("fixed_price", 10.5)).not.toBeNull();
    expect(validateDiscount("percent", Number.NaN)).not.toBeNull();
  });

  it("limits percentages to 1..95", () => {
    expect(validateDiscount("percent", 1)).toBeNull();
    expect(validateDiscount("percent", 95)).toBeNull();
    expect(validateDiscount("percent", 96)?.message).toMatch(/between 1 and 95/);
    expect(validateDiscount("percent", 100)).not.toBeNull();
  });

  it("accepts large amounts (checked against prices elsewhere)", () => {
    expect(validateDiscount("amount_off", 1_000_000)).toBeNull();
    expect(validateDiscount("fixed_price", 1)).toBeNull();
  });
});

describe("describeOffer", () => {
  const fmt = (m: number) => `₹${m / 100}`;
  it("formats each type", () => {
    expect(describeOffer("percent", 5, fmt)).toBe("5% off");
    expect(describeOffer("amount_off", 50_000, fmt)).toBe("₹500 off");
    expect(describeOffer("fixed_price", 99_900, fmt)).toBe("Offer price ₹999");
  });
});
