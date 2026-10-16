import { expect, type BrowserContext, type Page } from "@playwright/test";

export const PASSWORD = "Demo-pass-123";
export const USERS = {
  customer: "customer@locafy.test",
  merchant1: "merchant1@locafy.test",
  merchant2: "merchant2@locafy.test",
  admin: "admin@locafy.test",
} as const;
export type Role = keyof typeof USERS;

export const authFile = (role: Role) => `e2e/.auth/${role}.json`;

/** Kochi (Vyttila area) — demo shops are 3–4 km away. */
export const KOCHI = { lat: 10.0, lng: 76.32, label: "Kochi", radiusKm: 10, source: "manual" as const };

export async function setLocation(context: BrowserContext, baseURL: string, loc: typeof KOCHI | null = KOCHI) {
  if (!loc) return context.clearCookies({ name: "locafy_loc" });
  await context.addCookies([{ name: "locafy_loc", value: encodeURIComponent(JSON.stringify(loc)), url: baseURL }]);
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export function uniq(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

export const E2E_ORIGIN = "http://localhost:3100";

/** Fails if the page scrolls sideways (mobile layout check). */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
  expect(scrollWidth, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(innerWidth);
}
