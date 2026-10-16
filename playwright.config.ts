import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against a production build (`next start`) on port 3100 with its own
 * database (E2E_DATABASE_URL), so it never touches development data and can
 * run while `next dev` is running. Run `pnpm build` first.
 */
process.loadEnvFile?.(".env");
const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://locafy:locafy_dev_pw@localhost:54329/locafy_e2e";
process.env.E2E_DATABASE_URL = E2E_DB;
const PORT = 3100;
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "desktop", testMatch: /.*\.spec\.ts/, testIgnore: /mobile\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", testMatch: /mobile\.spec\.ts/, dependencies: ["setup"], use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `${BASE}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DB,
      APP_URL: BASE,
      GEOCODER_URL: "",
      NEXT_PUBLIC_MAP_STYLE_URL: process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "",
    },
  },
});
