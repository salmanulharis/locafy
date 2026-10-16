import { describe, expect, it } from "vitest";
import { buildSearchText, productIdentityKey } from "@/modules/catalog/identity";
import { roleAllows, SHOP_PERMISSIONS, type ShopPermission, type ShopRole } from "@/modules/access/permissions";
import { isWithinLimit, mergeEntitlements, FALLBACK_ENTITLEMENTS } from "@/modules/subscriptions/entitlements";

describe("productIdentityKey", () => {
  const a55 = { brand: "Samsung", model: "Galaxy A55", name: "Samsung Galaxy A55 5G", variant: "8GB / 128GB" };

  it("builds brand|model|variant", () => {
    expect(productIdentityKey(a55)).toBe("samsung|galaxy a55|8gb 128gb");
  });

  it("different variants are different products", () => {
    expect(productIdentityKey(a55)).not.toBe(productIdentityKey({ ...a55, variant: "8GB / 256GB" }));
    expect(productIdentityKey({ ...a55, variant: undefined })).not.toBe(productIdentityKey(a55));
  });

  it("normalises case, punctuation, whitespace and accents", () => {
    expect(productIdentityKey({ brand: "  SAMSUNG ", model: "galaxy-a55", name: "x", variant: "8gb/128gb" })).toBe(
      productIdentityKey(a55),
    );
    expect(productIdentityKey({ brand: "Nestlé", name: "Café" })).toBe(productIdentityKey({ brand: "nestle", name: "CAFE" }));
  });

  it("falls back to name when no model, and '-' for missing brand/variant", () => {
    expect(productIdentityKey({ name: "Matta Rice" })).toBe("-|matta rice|-");
    expect(productIdentityKey({ brand: null, model: "", name: "Matta Rice", variant: null })).toBe("-|matta rice|-");
  });

  it("model takes precedence over the display name", () => {
    expect(productIdentityKey({ brand: "Anker", model: "A2149", name: "Anker 20W Charger" })).toBe(
      productIdentityKey({ brand: "Anker", model: "A2149", name: "Anker USB-C 20 W adapter" }),
    );
  });

  it("different brands with the same model differ", () => {
    expect(productIdentityKey({ brand: "A", model: "X1", name: "n" })).not.toBe(productIdentityKey({ brand: "B", model: "X1", name: "n" }));
  });
});

describe("buildSearchText", () => {
  it("joins fields lowercase and skips long spec values", () => {
    const t = buildSearchText({
      name: "Galaxy A55",
      brand: "Samsung",
      brandAliases: ["samsng"],
      model: "SM-A556",
      variant: "8GB",
      aliases: ["a55 phone"],
      category: "Smartphones Mobiles",
      specs: { RAM: "8 GB", Notes: "x".repeat(41) },
    });
    expect(t).toBe("galaxy a55 samsung samsng sm-a556 8gb a55 phone smartphones mobiles 8 gb");
  });
});

describe("isWithinLimit", () => {
  const ent = { ...FALLBACK_ENTITLEMENTS, maxListings: 25, maxActiveOffers: 0, maxStaff: -1 };
  it("inclusive upper bound", () => {
    expect(isWithinLimit(ent, "maxListings", 24)).toBe(true);
    expect(isWithinLimit(ent, "maxListings", 25)).toBe(true);
    expect(isWithinLimit(ent, "maxListings", 26)).toBe(false);
  });
  it("zero means none allowed", () => {
    expect(isWithinLimit(ent, "maxActiveOffers", 0)).toBe(true);
    expect(isWithinLimit(ent, "maxActiveOffers", 1)).toBe(false);
  });
  it("-1 means unlimited", () => {
    expect(isWithinLimit(ent, "maxStaff", 1_000_000)).toBe(true);
  });
  it("fractional storage values", () => {
    const e = { ...FALLBACK_ENTITLEMENTS, maxStorageMb: 50 };
    expect(isWithinLimit(e, "maxStorageMb", 49.99)).toBe(true);
    expect(isWithinLimit(e, "maxStorageMb", 50.0001)).toBe(false);
  });
  it("mergeEntitlements fills gaps from the fallback", () => {
    expect(mergeEntitlements({ maxListings: 5 })).toEqual({ ...FALLBACK_ENTITLEMENTS, maxListings: 5 });
    expect(mergeEntitlements(null)).toEqual(FALLBACK_ENTITLEMENTS);
  });
});

describe("roleAllows matrix", () => {
  const all = Object.keys(SHOP_PERMISSIONS) as ShopPermission[];

  it("owner can do everything", () => {
    for (const p of all) expect(roleAllows("owner", p)).toBe(true);
  });

  it("no role / null role can do nothing", () => {
    for (const p of all) {
      expect(roleAllows(null, p)).toBe(false);
      expect(roleAllows(undefined, p)).toBe(false);
    }
  });

  const expected: Record<Exclude<ShopRole, "owner">, ShopPermission[]> = {
    manager: [
      "shop.view",
      "shop.edit",
      "listing.manage",
      "inventory.update",
      "offer.manage",
      "enquiry.respond",
      "review.respond",
      "analytics.view",
      "media.upload",
    ],
    staff: ["shop.view", "inventory.update", "enquiry.respond"],
  };

  it.each(["manager", "staff"] as const)("%s has exactly the expected permissions", (role) => {
    const granted = all.filter((p) => roleAllows(role, p));
    expect(new Set(granted)).toEqual(new Set(expected[role]));
  });

  it("staff cannot manage listings, offers or members", () => {
    expect(roleAllows("staff", "listing.manage")).toBe(false);
    expect(roleAllows("staff", "offer.manage")).toBe(false);
    expect(roleAllows("staff", "shop.members")).toBe(false);
    expect(roleAllows("staff", "inventory.update")).toBe(true);
  });

  it("member management, submission and billing are owner-only", () => {
    for (const p of ["shop.members", "shop.submit", "subscription.view"] as const) {
      expect(roleAllows("owner", p)).toBe(true);
      expect(roleAllows("manager", p)).toBe(false);
      expect(roleAllows("staff", p)).toBe(false);
    }
  });
});
