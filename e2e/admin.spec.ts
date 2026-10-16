import { expect, test } from "@playwright/test";
import { authFile } from "./helpers";

const details = `Price on the shelf differs from the listing — e2e ${Date.now().toString(36)}`;
const note = "Checked with the shop; price corrected.";

test.describe.serial("reports moderation", () => {
  test.describe("customer", () => {
    test.use({ storageState: authFile("customer") });

    test("14a. a customer reports incorrect product information", async ({ page }) => {
      await page.goto("/search?q=galaxy a55");
      await page.locator("main article").first().getByRole("link").first().click();
      await expect(page).toHaveURL(/\/p\//);
      await page.getByRole("button", { name: "Report incorrect information" }).click();
      const dialog = page.getByRole("dialog", { name: "Report a problem" });
      await dialog.getByLabel("What's wrong?").selectOption("incorrect_info");
      await dialog.getByLabel("Details").fill(details);
      await dialog.getByRole("button", { name: "Send report" }).click();
      await expect(dialog).toBeHidden();
      await expect(page.getByText("Thanks for the report. Our team will review it.")).toBeVisible();
    });
  });

  test.describe("admin", () => {
    test.use({ storageState: authFile("admin") });

    test("14b. an admin resolves the report and it moves to the actioned tab", async ({ page }) => {
      await page.goto("/admin/reports");
      await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
      const report = page.getByRole("article").filter({ hasText: details });
      await expect(report).toBeVisible();
      await expect(report).toContainText("Product");
      await expect(report).toContainText("Reported by Priya");
      await report.getByLabel("Outcome").selectOption("actioned");
      await report.getByLabel("Resolution note").fill(note);
      await report.getByRole("button", { name: "Resolve report" }).click();
      await expect(report).toBeHidden();

      await page.reload();
      await expect(page.getByRole("article").filter({ hasText: details })).toHaveCount(0);
      await page.getByRole("link", { name: "Actioned" }).click();
      await expect(page).toHaveURL(/status=actioned/);
      const resolved = page.getByRole("article").filter({ hasText: details });
      await expect(resolved).toBeVisible();
      await expect(resolved).toContainText(note);
      await expect(resolved).toContainText("Resolved");
      await expect(resolved.getByRole("button", { name: "Resolve report" })).toHaveCount(0);
    });
  });
});
