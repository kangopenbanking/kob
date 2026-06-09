/**
 * E2E — STEP_UP_REQUIRED handling on /admin/business-kyc.
 * Same shape as step-up-kyc-review.spec.ts but targets admin-kyb-verify.
 */
import { test, expect } from '@playwright/test';
import { loginAs, SHOULD_RUN } from './helpers';

test.describe('Admin step-up required — KYB verify', () => {
  test.skip(!SHOULD_RUN, 'E2E test users not seeded — see e2e/SEEDING.md');

  test('approve action surfaces step-up dialog on aal1 session', async ({ page }) => {
    test.setTimeout(60_000);
    const ok = await loginAs(page, 'admin');
    expect(ok).toBe(true);

    await page.goto('/admin/business-kyc');

    const row = page.locator('table tbody tr').first();
    if (await row.count() === 0) test.skip(true, 'No KYB submissions to act on.');

    await row.click().catch(() => {});
    const approve = page.getByRole('button', { name: /^approve$/i }).first();
    if (await approve.count() === 0) test.skip(true, 'Approve CTA hidden.');
    await approve.click().catch(() => {});
    const confirm = page.getByRole('button', { name: /^approve$/i }).last();
    await confirm.click().catch(() => {});

    await expect(page.getByText(/step-up authentication required/i)).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="step-up-cancel"]').click();
    await expect(page.getByText(/step-up authentication required/i)).toBeHidden();
  });
});
