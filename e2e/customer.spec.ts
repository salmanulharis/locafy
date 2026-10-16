import { expect, test } from "@playwright/test";
import { authFile, KOCHI, setLocation } from "./helpers";

test.describe("guest discovery", () => {
  test("1. a guest searches for a product without signing in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find it in a shop near you");
    const box = page.getByRole("combobox", { name: "Search for a product" }).first();
    await box.fill("anker charger");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=anker/);
    await expect(page.getByRole("heading", { name: /Results for/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Anker 20W USB-C Charger" }).first()).toBeVisible();
  });

  test("2. the customer selects a town manually and gets nearby results", async ({ page }) => {
    await page.goto("/search?q=atta");
    await expect(page.getByText("Set your location to see distances")).toBeVisible();
    await page.getByRole("button", { name: /Set your location/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Choose your location" });
    await dialog.getByLabel("Search town, locality or postal code").fill("Kakkan");
    await dialog.getByRole("option", { name: /Kakkanad/ }).click();
    await expect(page.getByText(/results? within 10 km of Kakkanad/)).toBeVisible();
    await expect(page.getByText(/\d+(\.\d)? k?m · Kochi/).first()).toBeVisible();
  });

  test("denied geolocation falls back to manual search", async ({ page, context }) => {
    await context.clearPermissions();
    await page.goto("/");
    await page.getByRole("button", { name: /Set your location/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Choose your location" });
    // Simulate a permission denial deterministically.
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (_ok, err) => err?.({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    });
    await dialog.getByRole("button", { name: "Use my current location" }).click();
    await expect(dialog.getByText("Location permission was denied")).toBeVisible();
    await expect(dialog.getByLabel("Search town, locality or postal code")).toBeVisible();
  });

  test("3. sellers are compared by price and distance; variants are not merged", async ({ page, context, baseURL }) => {
    await setLocation(context, baseURL!, KOCHI);
    await page.goto("/search?q=anker charger&sort=price");
    const results = page.locator("main article");
    await expect(results).toHaveCount(2);
    await expect(results.nth(0)).toContainText("₹1,199");
    await expect(results.nth(1)).toContainText("₹1,299");
    await results.nth(0).getByRole("link", { name: "Anker 20W USB-C Charger" }).click();
    await expect(page.getByRole("heading", { name: /Where to buy/ })).toBeVisible();
    const sellers = page.getByRole("list").filter({ hasText: "Demo Hardware Vyttila" });
    await expect(sellers.getByText("Lowest price")).toBeVisible();
    await expect(page.getByText(/may be outdated/)).toBeVisible(); // Vyttila stock is 20 days old

    await page.goto("/search?q=galaxy a55");
    await expect(page.locator("main article")).toHaveCount(2);
    await expect(page.getByText("128GB").first()).toBeVisible();
    await expect(page.getByText("256GB").first()).toBeVisible();
  });

  test("4. the customer opens a shop and gets directions", async ({ page, context, baseURL }) => {
    await setLocation(context, baseURL!, KOCHI);
    await page.goto("/shops");
    await page.getByRole("link", { name: "Demo Mobiles Edappally" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Demo Mobiles Edappally");
    await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible();
    const directions = page.getByRole("link", { name: "Directions" }).first();
    await expect(directions).toHaveAttribute("href", /google\.com\/maps\/dir\/\?api=1&destination=10\.02/);
    await expect(directions).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("link", { name: "Call" }).first()).toHaveAttribute("href", /^tel:\+91/);
  });

  test("empty results explain and offer alternatives", async ({ page, context, baseURL }) => {
    await setLocation(context, baseURL!, KOCHI);
    await page.goto("/search?q=zzzz-no-such-product");
    await expect(page.getByText(/No shops list this product yet|No products found/)).toBeVisible();
    await page.goto("/search?q=samsng");
    await expect(page.getByText("showing products with a similar spelling")).toBeVisible();
  });

  test("product outside the radius is flagged", async ({ page, context, baseURL }) => {
    await setLocation(context, baseURL!, { ...KOCHI, lat: 8.5241, lng: 76.9366, label: "Thiruvananthapuram" });
    await page.goto("/search?q=atta");
    await expect(page.getByText("Not available within your search radius")).toBeVisible();
  });
});

test.describe("signed-in customer", () => {
  test.use({ storageState: authFile("customer") });

  test("saves and removes a product (persisted)", async ({ page }) => {
    await page.goto("/search?q=boat airdopes");
    await page.getByRole("link", { name: "boAt Airdopes 141" }).first().click();
    const save = page.getByRole("button", { name: "Save", exact: true });
    await save.click();
    await expect(page.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/saved");
    await expect(page.getByRole("link", { name: /boAt Airdopes 141/ })).toBeVisible();
    await page.getByRole("button", { name: "Saved" }).first().click();
    await page.reload();
    await expect(page.getByText("No saved products")).toBeVisible();
  });

  test("13. submits a product review", async ({ page }) => {
    await page.goto("/search?q=sambar powder");
    await page.getByRole("link", { name: "Eastern Sambar Powder" }).first().click();
    await page.getByRole("radio", { name: "4 stars" }).check({ force: true });
    await page.getByLabel(/Comment/).fill("Fresh stock and the price matched the listing.");
    await page.getByRole("button", { name: "Post review" }).click();
    await expect(page.getByText("Thanks — your review is published.")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Reviews" }).getByRole("paragraph").filter({ hasText: "Fresh stock and the price matched" })).toBeVisible();
    await expect(page.getByText(/verified purchase/i)).toHaveCount(0);
  });
});
