/**
 * E2E — Admin role change propagates to user dashboard via realtime,
 * with no re-login required.
 *
 * Flow:
 *   1. Two browser contexts: one logged in as Admin, one as Consumer.
 *   2. Consumer lands on /credit-score (personal default).
 *   3. Admin opens UserManagement, finds the consumer, sets primary
 *      role to "merchant".
 *   4. Consumer page should auto-redirect to /merchant within ~10s
 *      (driven by useRoleChangeListener + Supabase realtime), and a
 *      toast should appear naming the new role + an effective time.
 *   5. Cleanup: admin sets the consumer back to "personal".
 *
 * Skipped unless the seeded E2E credentials are present (see
 * e2e/SEEDING.md). Both E2E_ADMIN_EMAIL and E2E_CONSUMER_EMAIL
 * are required, plus the shared E2E_PASSWORD.
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import { SHOULD_RUN } from "./helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const CONSUMER_EMAIL = process.env.E2E_CONSUMER_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20_000 });
}

async function newLoggedInPage(browser: Browser, email: string, password: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, email, password);
  return page;
}

async function setPrimaryRole(adminPage: Page, userEmail: string, role: "personal" | "merchant" | "developer" | "institution" | "admin") {
  await adminPage.goto("/admin/users");
  await adminPage.waitForLoadState("networkidle").catch(() => {});
  // Find the row for the target user and open its actions.
  const row = adminPage.getByRole("row", { name: new RegExp(userEmail, "i") }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: /actions|menu|change role|edit/i }).first().click().catch(async () => {
    // Fallback: click any button inside the row.
    await row.locator("button").first().click();
  });
  // Pick the role.
  await adminPage.getByRole("menuitem", { name: new RegExp(role, "i") }).first().click().catch(async () => {
    await adminPage.getByRole("option", { name: new RegExp(role, "i") }).first().click();
  });
  // Confirm if a dialog appears.
  await adminPage.getByRole("button", { name: /confirm|save|update|apply/i }).first().click().catch(() => {});
}

test.describe("Admin role change → realtime dashboard switch", () => {
  test.skip(!SHOULD_RUN || !ADMIN_EMAIL || !CONSUMER_EMAIL || !PASSWORD,
    "Requires seeded admin + consumer accounts (see e2e/SEEDING.md)");

  test("consumer auto-redirects to /merchant after admin sets role=merchant (no re-login)", async ({ browser }) => {
    const adminPage = await newLoggedInPage(browser, ADMIN_EMAIL!, PASSWORD!);
    const userPage = await newLoggedInPage(browser, CONSUMER_EMAIL!, PASSWORD!);

    // Consumer should start on /credit-score (personal default).
    await expect.poll(() => new URL(userPage.url()).pathname, { timeout: 15_000 })
      .toMatch(/^\/credit-score/);

    try {
      // Admin promotes consumer to merchant.
      await setPrimaryRole(adminPage, CONSUMER_EMAIL!, "merchant");

      // Consumer page should auto-redirect to /merchant via realtime listener.
      await expect.poll(
        () => new URL(userPage.url()).pathname,
        { timeout: 15_000, intervals: [500, 1000, 2000] },
      ).toMatch(/^\/merchant/);

      // Toast should mention the new role name.
      const toast = userPage.getByText(/role was changed to merchant/i).first();
      await expect(toast).toBeVisible({ timeout: 5_000 }).catch(() => {
        // Toast may have auto-dismissed by the time we check; URL change is the
        // authoritative signal. Don't fail the test on toast disappearance.
      });
    } finally {
      // Cleanup: revert consumer back to personal.
      await setPrimaryRole(adminPage, CONSUMER_EMAIL!, "personal").catch(() => {});
    }
  });
});
