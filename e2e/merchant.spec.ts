import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { authFile, KOCHI, PASSWORD, setLocation } from "./helpers";

/**
 * One merchant's life on Locafy, end to end: sign-up → onboarding → admin
 * approval → product → stock/price → offer → customer enquiry and reply →
 * plan limit. Steps share state, so they run serially in this order.
 */
const NEW_MERCHANT_STATE = "e2e/.auth/new-merchant.json";
const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const merchant = { name: "Esha Merchant", email: `e2e-merchant-${suffix}@locafy.test` };
const shopName = `E2E Electronics ${suffix}`;
const productName = `Zentrix Widget ${suffix}`;
const offerTitle = `Zentrix launch week ${suffix}`;

let shopId = "";
let shopSlug = "";
let listingId = "";
let productSlug = "";
let enquiryId = "";

const contexts: BrowserContext[] = [];

/** A separate signed-in (or guest) browser for another actor in the same story. */
async function actor(browser: Browser, baseURL: string, storageState: string | null): Promise<Page> {
  const context = await browser.newContext({ baseURL, storageState: storageState ?? undefined, locale: "en-IN", timezoneId: "Asia/Kolkata" });
  contexts.push(context);
  await setLocation(context, baseURL, KOCHI);
  return context.newPage();
}

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test.describe.serial("merchant journey", () => {
  test("5. a new merchant registers and submits a shop for review", async ({ page, context, baseURL }) => {
    await page.goto("/register?next=/merchant");
    await page.getByLabel("Full name").fill(merchant.name);
    await page.getByLabel("Email").fill(merchant.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/merchant$/);
    await expect(page.getByRole("heading", { name: "Get your shop found by nearby customers" })).toBeVisible();

    // Step 1 — details
    await page.getByRole("link", { name: "Create your shop" }).click();
    await page.getByLabel("Shop name").fill(shopName);
    await page.getByLabel("Main category").selectOption({ index: 1 });
    await page.getByLabel("Short description").fill("Phones, chargers and accessories. Test shop created by the e2e suite.");
    await page.getByRole("button", { name: "Create shop and continue" }).click();
    await expect(page).toHaveURL(/\/merchant\/[0-9a-f-]{36}\/onboarding\?step=2/);
    shopId = page.url().match(/\/merchant\/([0-9a-f-]{36})\//)![1]!;
    await expect(page.getByText("Shop created.")).toBeVisible();

    // Step 2 — address + map pin from device location
    await page.getByLabel("Street address").fill("12 Test Road, near Metro Pillar 400");
    await page.getByLabel("Area / locality").fill("Palarivattom");
    await page.getByLabel("Town or city").fill("Kochi");
    await page.getByLabel("State").fill("Kerala");
    await page.getByLabel("PIN code").fill("682025");
    await context.grantPermissions(["geolocation"], { origin: baseURL });
    await context.setGeolocation({ latitude: 10.01, longitude: 76.31 });
    await page.getByRole("button", { name: "Use my current location" }).click();
    await expect(page.getByText("Pin at 10.01000, 76.31000")).toBeVisible();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/onboarding\?step=3/);

    // Step 3 — contact & hours
    await page.getByLabel("Phone", { exact: true }).fill("+91 98470 11111");
    await page.getByLabel("Monday opens").fill("09:30");
    await page.getByLabel("Monday closes").fill("20:30");
    await page.getByRole("button", { name: "Copy Monday to Tuesday–Saturday" }).click();
    await expect(page.getByLabel("Saturday opens")).toHaveValue("09:30");
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/onboarding\?step=4/);

    // Step 4 — photos are optional
    await page.getByRole("link", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/onboarding\?step=5/);

    // Step 5 — verification
    await expect(page.getByText("All required details are complete.")).toBeVisible();
    await page.getByLabel("Business verification details").fill("GSTIN 32ABCDE1234F1Z5 — trade licence KOC/2026/123.");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Submitted — under review")).toBeVisible();

    // Persisted: earlier steps kept their values, and the shop shows as under review.
    await page.reload();
    await expect(page.getByText("Submitted — under review")).toBeVisible();
    await page.goto(`/merchant/${shopId}/onboarding?step=3`);
    await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("+91 98470 11111");
    await expect(page.getByLabel("Wednesday closes")).toHaveValue("20:30");
    await page.goto("/merchant");
    await expect(page.getByRole("link", { name: shopName })).toBeVisible();
    await expect(page.getByText("Under review by Locafy")).toBeVisible();

    await context.storageState({ path: NEW_MERCHANT_STATE });
  });

  test("6. an admin approves the pending shop and it goes live", async ({ browser, baseURL }) => {
    const admin = await actor(browser, baseURL!, authFile("admin"));
    await admin.goto("/admin/shops");
    await admin.getByRole("link", { name: /Pending approval/ }).click();
    await expect(admin).toHaveURL(/status=pending/);
    await admin.getByRole("link", { name: shopName }).click();
    await expect(admin).toHaveURL(new RegExp(`/admin/shops/${shopId}`));
    await admin.getByRole("button", { name: "Approve", exact: true }).click();
    const dialog = admin.getByRole("dialog", { name: `Approve ${shopName}?` });
    await dialog.getByRole("button", { name: "Approve shop" }).click();
    await expect(dialog).toBeHidden();
    await admin.reload();
    await expect(admin.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);
    await expect(admin.getByRole("button", { name: "Suspend" })).toBeVisible();

    // The merchant sees the shop as live…
    const m = await actor(browser, baseURL!, NEW_MERCHANT_STATE);
    await m.goto(`/merchant/${shopId}/onboarding?step=5`);
    await expect(m.getByText("Your shop is approved and live")).toBeVisible();
    const res = await m.request.get(`/api/v1/merchant/shops/${shopId}`);
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { shop: { slug: string; status: string } } };
    expect(body.data.shop.status).toBe("active");
    shopSlug = body.data.shop.slug;

    // …and so does a guest.
    const guest = await actor(browser, baseURL!, null);
    await guest.goto(`/s/${shopSlug}`);
    await expect(guest.getByRole("heading", { level: 1 })).toContainText(shopName);
    await expect(guest.getByRole("heading", { name: "Opening hours" })).toBeVisible();
  });

  test.describe("as the new merchant", () => {
    test.use({ storageState: NEW_MERCHANT_STATE });

    test("7. publishes a new catalogue product", async ({ page }) => {
      await page.goto(`/merchant/${shopId}/products/new`);
      await page.getByRole("combobox", { name: "Find the product" }).fill(productName);
      await expect(page.getByText("No matching product in the catalogue.")).toBeVisible();
      await page.getByRole("button", { name: /Add a new product/ }).click();
      await expect(page.getByLabel("Product name")).toHaveValue(productName);
      await page.getByLabel("Brand").fill("Zentrix");
      await page.getByLabel("Category", { exact: true }).selectOption({ index: 1 });
      await page.getByLabel("Selling price (₹)").fill("5000");
      await page.getByLabel("Quantity in stock").fill("10");
      await page.getByRole("button", { name: "Save & publish" }).click();

      await expect(page).toHaveURL(/\/products\/[0-9a-f-]{36}\?created=published/);
      listingId = page.url().match(/\/products\/([0-9a-f-]{36})/)![1]!;
      await expect(page.getByText("Product published. Customers nearby can now find it.")).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Published");
      const publicLink = page.getByRole("link", { name: "View public page" });
      productSlug = (await publicLink.getAttribute("href"))!.replace(/^\/p\//, "");
      expect(productSlug).toBeTruthy();

      await page.goto(`/merchant/${shopId}/products`);
      await expect(page.getByRole("link", { name: productName })).toBeVisible();
    });

    test("8. updates price and stock on the listing", async ({ page }) => {
      await page.goto(`/merchant/${shopId}/products/${listingId}`);
      await page.getByLabel("Selling price (₹)").fill("4499");
      await page.getByLabel("Quantity in stock").fill("2");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Stock and price saved")).toBeVisible();

      await page.reload();
      await expect(page.getByLabel("Selling price (₹)")).toHaveValue("4499");
      await expect(page.getByLabel("Quantity in stock")).toHaveValue("2");
      await expect(page.getByText(/₹4,499 · stock updated/)).toBeVisible();
      const history = page.getByRole("region", { name: "Change history" });
      await expect(history.getByRole("table").getByRole("row").nth(1)).toContainText("₹5,000 → ₹4,499");
      await expect(history.getByRole("table").getByRole("row").nth(1)).toContainText("10 → 2");
    });
  });

  test("9. public search reflects the new price and stock", async ({ browser, baseURL }) => {
    const guest = await actor(browser, baseURL!, null);
    await guest.goto(`/search?q=${encodeURIComponent(productName)}`);
    const card = guest.locator("main article").filter({ has: guest.getByRole("link", { name: productName }) });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("₹4,499");
    await expect(card).toContainText("Low stock");
    await expect(card).not.toContainText("₹5,000");
  });

  test("10. the merchant publishes an offer and customers see it", async ({ browser, baseURL }) => {
    const m = await actor(browser, baseURL!, NEW_MERCHANT_STATE);
    await m.goto(`/merchant/${shopId}/offers/new`);
    await m.getByLabel("Offer title").fill(offerTitle);
    await m.getByRole("radio", { name: "Amount off (₹)" }).check();
    await m.getByRole("textbox", { name: "Amount off (₹)" }).fill("500");
    await m.getByLabel("Conditions").fill("While stocks last.");
    await m.getByRole("checkbox", { name: productName }).check();
    await expect(m.getByText("1 selected")).toBeVisible();
    await m.getByRole("button", { name: "Save & publish" }).click();
    await expect(m).toHaveURL(/\/offers\/[0-9a-f-]{36}\?saved=1/);
    await m.reload();
    await expect(m.getByText(offerTitle).first()).toBeVisible();

    const customer = await actor(browser, baseURL!, authFile("customer"));
    await customer.goto(`/p/${productSlug}`);
    const row = customer.getByRole("listitem").filter({ has: customer.getByRole("link", { name: shopName }) });
    await expect(row.getByText(offerTitle)).toBeVisible();
    await expect(row).toContainText("₹3,999");

    await customer.goto("/offers");
    const card = customer.locator("article").filter({ hasText: offerTitle });
    await expect(card).toBeVisible();
    await expect(card).toContainText("₹500 off");
    await expect(card.getByRole("link", { name: productName })).toBeVisible();
  });

  test("11. the customer asks the shop about the product", async ({ browser, baseURL }) => {
    const customer = await actor(browser, baseURL!, authFile("customer"));
    await customer.goto(`/p/${productSlug}`);
    const row = customer.getByRole("listitem").filter({ has: customer.getByRole("link", { name: shopName }) });
    await row.getByRole("button", { name: "Ask the shop" }).click();
    const dialog = customer.getByRole("dialog", { name: `Ask ${shopName}` });
    await dialog.getByLabel("Quantity").fill("2");
    await dialog.getByLabel("Message").fill(`Is ${productName} available? I'd like two, can I pick them up today?`);
    await dialog.getByRole("button", { name: "Send enquiry" }).click();
    const view = dialog.getByRole("link", { name: "View conversation" });
    await expect(view).toBeVisible();
    enquiryId = (await view.getAttribute("href"))!.split("/").pop()!;
    await view.click();
    await expect(customer).toHaveURL(new RegExp(`/account/enquiries/${enquiryId}`));
    await expect(customer.getByText("I'd like two, can I pick them up today?")).toBeVisible();

    await customer.goto("/account/enquiries");
    await expect(customer.getByText(shopName).first()).toBeVisible();
  });

  test("12. the merchant replies and the customer sees the reply", async ({ browser, baseURL }) => {
    const m = await actor(browser, baseURL!, NEW_MERCHANT_STATE);
    await m.goto(`/merchant/${shopId}/enquiries`);
    await m.getByRole("listitem").filter({ hasText: productName }).getByRole("link", { name: "Priya M." }).click();
    await expect(m).toHaveURL(new RegExp(`/merchant/${shopId}/enquiries/${enquiryId}`));
    await expect(m.getByText("I'd like two, can I pick them up today?")).toBeVisible();
    await m.getByLabel("Your reply").fill("Yes, two are in stock. We are open until 8:30 pm.");
    await m.getByRole("button", { name: "Send reply" }).click();
    await expect(m.getByRole("list", { name: "Messages" }).getByText("Yes, two are in stock.")).toBeVisible();
    await m.reload();
    await expect(m.getByRole("list", { name: "Messages" }).getByText("Yes, two are in stock.")).toBeVisible();

    const customer = await actor(browser, baseURL!, authFile("customer"));
    await customer.goto(`/account/enquiries/${enquiryId}`);
    await expect(customer.getByRole("list", { name: "Messages" }).getByText("Yes, two are in stock. We are open until 8:30 pm.")).toBeVisible();
    await expect(customer.getByText("Replied", { exact: true })).toBeVisible();
  });

  test("16. the free plan's listing limit is enforced with a link to the plan", async ({ browser, baseURL, playwright }) => {
    // Fill the shop up to the plan limit through the API (bearer token), then try one more in the UI.
    const api = await playwright.request.newContext({ baseURL });
    const login = await api.post("/api/v1/auth/login", { data: { email: merchant.email, password: PASSWORD, client: "mobile" } });
    expect(login.status()).toBe(200);
    const { token } = ((await login.json()) as { data: { token: string } }).data;
    const auth = { Authorization: `Bearer ${token}` };

    const shopRes = await api.get(`/api/v1/merchant/shops/${shopId}`, { headers: auth });
    const branchId = ((await shopRes.json()) as { data: { branches: { id: string }[] } }).data.branches[0]!.id;
    const cats = ((await (await api.get("/api/v1/categories?scope=product")).json()) as { data: { id: string; parentId: string | null }[] }).data;
    const leaf = cats.find((c) => c.parentId && !cats.some((x) => x.parentId === c.id)) ?? cats[0]!;

    const listRes = await api.get(`/api/v1/merchant/shops/${shopId}/listings?status=active&pageSize=100`, { headers: auth });
    const listBody = (await listRes.json()) as { data: unknown[]; meta?: { total?: number } };
    const count = listBody.meta?.total ?? listBody.data.length;
    expect(count).toBe(1); // the product published in step 7
    const LIMIT = 25;
    for (let i = count; i < LIMIT; i++) {
      const r = await api.post(`/api/v1/merchant/shops/${shopId}/listings`, {
        headers: auth,
        data: { product: { name: `Zentrix Filler ${suffix} ${i}`, categoryId: leaf.id }, stock: [{ branchId, price: "100", quantity: 5 }] },
      });
      expect(r.status(), await r.text()).toBe(201);
    }
    // The API refuses the next one as well.
    const over = await api.post(`/api/v1/merchant/shops/${shopId}/listings`, {
      headers: auth,
      data: { product: { name: `Zentrix Over ${suffix}`, categoryId: leaf.id }, stock: [{ branchId, price: "100" }] },
    });
    expect(over.status()).toBe(402);
    expect(((await over.json()) as { error: { code: string } }).error.code).toBe("LIMIT_EXCEEDED");
    await api.dispose();

    const m = await actor(browser, baseURL!, NEW_MERCHANT_STATE);
    await m.goto(`/merchant/${shopId}/products/new`);
    await m.getByRole("button", { name: /Add a new product/ }).click();
    await m.getByLabel("Product name").fill(`Zentrix One Too Many ${suffix}`);
    await m.getByLabel("Category", { exact: true }).selectOption({ index: 1 });
    await m.getByLabel("Selling price (₹)").fill("250");
    await m.getByRole("button", { name: "Save & publish" }).click();
    const notice = m.getByRole("status").filter({ hasText: "Plan limit reached" });
    await expect(notice).toContainText(`Your current plan allows up to ${LIMIT} product listings.`);
    await expect(m).toHaveURL(/\/products\/new$/);
    await notice.getByRole("link", { name: "See your plan" }).click();
    await expect(m).toHaveURL(new RegExp(`/merchant/${shopId}/plan`));

    // Nothing was created by the refused attempt.
    await m.goto(`/merchant/${shopId}/products?q=${encodeURIComponent("One Too Many")}`);
    await expect(m.getByRole("link", { name: /Zentrix One Too Many/ })).toHaveCount(0);
  });
});
