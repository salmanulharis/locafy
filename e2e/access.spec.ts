import { expect, test, type APIRequestContext } from "@playwright/test";
import { authFile, E2E_ORIGIN } from "./helpers";

type Ids = { shopId: string; listingId: string; inventoryId: string; version: number; priceMinor: number };

/** Look up one of merchant1's shops, listings and inventory rows as merchant1. */
async function merchant1Ids(m1: APIRequestContext): Promise<Ids> {
  const shops = (await (await m1.get("/api/v1/merchant/shops")).json()) as { data: { id: string; name: string }[] };
  const shop = shops.data.find((s) => s.name === "Demo Mobiles Edappally");
  expect(shop, "merchant1 owns Demo Mobiles Edappally").toBeTruthy();
  const listings = (await (await m1.get(`/api/v1/merchant/shops/${shop!.id}/listings`)).json()) as { data: { id: string }[] };
  const listingId = listings.data[0]!.id;
  const detail = (await (await m1.get(`/api/v1/merchant/listings/${listingId}`)).json()) as {
    data: { stock: { id: string; version: number; priceMinor: number }[] };
  };
  const inv = detail.data.stock[0]!;
  return { shopId: shop!.id, listingId, inventoryId: inv.id, version: inv.version, priceMinor: inv.priceMinor };
}

test.describe("15. unauthorised access is denied", () => {
  let ids: Ids;

  test.beforeAll(async ({ playwright, baseURL }) => {
    const m1 = await playwright.request.newContext({ baseURL, storageState: authFile("merchant1") });
    ids = await merchant1Ids(m1);
    await m1.dispose();
  });

  test.describe("as merchant2", () => {
    test.use({ storageState: authFile("merchant2") });

    test("another merchant's shop pages show the 404 page", async ({ page }) => {
      for (const path of [`/merchant/${ids.shopId}`, `/merchant/${ids.shopId}/products`, `/merchant/${ids.shopId}/products/${ids.listingId}`]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
        await expect(page.getByText("you aren't a member of the shop it belongs to")).toBeVisible();
        await expect(page.getByText("Demo Mobiles Edappally")).toHaveCount(0);
      }
    });

    test("the merchant API hides other shops and refuses writes", async ({ page, playwright, baseURL }) => {
      const api = page.request;
      const shop = await api.get(`/api/v1/merchant/shops/${ids.shopId}`);
      expect(shop.status()).toBe(404);
      expect(((await shop.json()) as { error: { code: string } }).error.code).toBe("NOT_FOUND");

      const listing = await api.get(`/api/v1/merchant/listings/${ids.listingId}`);
      expect(listing.status()).toBe(404);

      const patch = await api.patch(`/api/v1/merchant/inventory/${ids.inventoryId}`, {
        headers: { Origin: E2E_ORIGIN, "If-Match": `"${ids.version}"` },
        data: { price: "1" },
      });
      expect(patch.status()).toBe(404);

      // Cookie-authenticated writes without a same-origin header are rejected before anything else.
      const crossSite = await api.patch(`/api/v1/merchant/inventory/${ids.inventoryId}`, {
        headers: { Origin: "https://evil.example", "If-Match": `"${ids.version}"` },
        data: { price: "1" },
      });
      expect(crossSite.status()).toBe(403);

      // merchant1's price is untouched.
      const m1 = await playwright.request.newContext({ baseURL, storageState: authFile("merchant1") });
      const after = await merchant1Ids(m1);
      await m1.dispose();
      expect(after.inventoryId).toBe(ids.inventoryId);
      expect(after.priceMinor).toBe(ids.priceMinor);
      expect(after.version).toBe(ids.version);
    });
  });

  test.describe("as a customer", () => {
    test.use({ storageState: authFile("customer") });

    test("the admin area is not revealed", async ({ page }) => {
      for (const path of ["/admin", "/admin/shops", "/admin/reports"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: /admin/i })).toHaveCount(0);
      }
      const api = await page.request.get("/api/v1/admin/shops");
      expect([403, 404]).toContain(api.status());
    });
  });

  test("a signed-out visitor is sent to sign in", async ({ page }) => {
    await page.goto("/merchant");
    await expect(page).toHaveURL(/\/login\?next=%2Fmerchant/);
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await page.goto(`/merchant/${ids.shopId}/products`);
    await expect(page).toHaveURL(/\/login\?next=/);
    const api = await page.request.get(`/api/v1/merchant/shops/${ids.shopId}`);
    expect(api.status()).toBe(401);
  });
});
