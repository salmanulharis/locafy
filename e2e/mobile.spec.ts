import { expect, test } from "@playwright/test";
import { authFile, expectNoHorizontalOverflow, KOCHI, setLocation } from "./helpers";

// Runs in the "mobile" project (Pixel 7).

test.describe("17. mobile customer", () => {
  test.use({ storageState: authFile("customer") });

  test("home → search → product → sellers → directions; bottom nav works", async ({ page, context, baseURL }) => {
    await setLocation(context, baseURL!, KOCHI);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find it in a shop near you");
    await expectNoHorizontalOverflow(page);

    const box = page.getByRole("combobox", { name: "Search for a product" }).first();
    await box.fill("redmi note");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=redmi/);
    await expect(page.getByRole("heading", { name: /Results for/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.locator("main article").first().getByRole("link", { name: "Redmi Note 13" }).click();
    await expect(page).toHaveURL(/\/p\//);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Redmi Note 13");
    await expect(page.getByRole("heading", { name: /Where to buy/ })).toBeVisible();
    const seller = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Demo Mobiles Edappally" }) });
    await expect(seller).toContainText("₹16,999");
    const directions = seller.getByRole("link", { name: "Directions" });
    await expect(directions).toBeVisible();
    await expect(directions).toHaveAttribute("href", /google\.com\/maps\/dir\//);
    await expectNoHorizontalOverflow(page);

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Saved" }).click();
    await expect(page).toHaveURL(/\/saved/);
    await expect(nav.getByRole("link", { name: "Saved" })).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalOverflow(page);

    await nav.getByRole("link", { name: "Account" }).click();
    await expect(page).toHaveURL(/\/account/);
    await expect(nav.getByRole("link", { name: "Account" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue("customer@locafy.test");
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("17. mobile merchant", () => {
  test.use({ storageState: authFile("merchant1") });

  test("dashboard via the menu → products → adjust stock", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Account menu").click();
    await page.getByRole("link", { name: "My shops" }).click();
    await expect(page).toHaveURL(/\/merchant$/);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "Demo Mobiles Edappally" }).click();
    await expect(page).toHaveURL(/\/merchant\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Demo Mobiles Edappally", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /Open shop menu/ }).click();
    const sheet = page.getByRole("dialog", { name: "Demo Mobiles Edappally" });
    await sheet.getByRole("link", { name: "Products" }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: /Redmi Note 13/ }).click();
    await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}$/);
    const qty = page.getByLabel("Quantity in stock");
    const before = Number(await qty.inputValue());
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Increase quantity by 1" }).click();
    await expect(page.getByText("Stock and price saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Quantity in stock")).toHaveValue(String(before + 1));
    await expectNoHorizontalOverflow(page);
  });
});
