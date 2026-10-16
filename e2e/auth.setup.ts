import { test as setup } from "@playwright/test";
import { authFile, login, USERS, type Role } from "./helpers";

// One real sign-in per role through the UI; specs reuse the saved session.
for (const role of Object.keys(USERS) as Role[]) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await login(page, USERS[role]);
    await page.context().storageState({ path: authFile(role) });
  });
}
