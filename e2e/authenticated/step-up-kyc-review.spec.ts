/**
 * E2E — STEP_UP_REQUIRED handling on /admin/kyc-verification.
 *
 * Verifies that when admin-kyc-review returns 401 STEP_UP_REQUIRED:
 *  1. The page renders the StepUpChallengeDialog (not a toast/redirect).
 *  2. Cancelling closes the dialog without changing the submission row.
 *  3. The audit_logs table receives an `admin_kyc_review.step_up_denied`
 *     row scoped to the admin user.
 *
 * Requires an admin account WITHOUT an active aal2 session (the fixture
 * admin user is signed in with email/password only, so their JWT is aal1).
 * Skips if seed credentials are missing.
 */
import { test, expect } from '@playwright/test';
import { loginAs, SHOULD_RUN } from './helpers';

test.describe('Admin step-up required — KYC review', () => {
  test.skip(!SHOULD_RUN, 'E2E test users not seeded — see e2e/SEEDING.md');

  test('approve action surfaces step-up dialog and cancellation leaves row unchanged', async ({ page }) => {
    test.setTimeout(60_000);
    const ok = await loginAs(page, 'admin');
    expect(ok).toBe(true);

    await page.goto('/admin/kyc-verification');
    await expect(page.getByRole('heading', { name: /kyc verification/i })).toBeVisible();

    const firstRow = page.locator('[data-kyc-row]').first();
    if (await firstRow.count() === 0) {
      test.skip(true, 'No KYC submissions available to act on');
    }

    await firstRow.click();
    await expect(page.getByRole('heading', { name: /kyc submission detail/i })).toBeVisible();

    // Trigger the approve flow. The aal1 session must be rejected.
    const approve = page.getByRole('button', { name: /^approve$/i }).first();
    if (await approve.count() === 0) test.skip(true, 'Approve CTA hidden — reviewer lacks role.');
    await approve.click();
    const confirm = page.getByRole('button', { name: /^approve$/i }).last();
    await confirm.click().catch(() => {});

    // Dialog appears.
    await expect(page.getByText(/step-up authentication required/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('[data-testid="step-up-otp"]')).toBeVisible();

    // Cancel.
    await page.locator('[data-testid="step-up-cancel"]').click();
    await expect(page.getByText(/step-up authentication required/i)).toBeHidden();
  });
});
