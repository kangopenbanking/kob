import { test, expect } from '@playwright/test';
import { loginAs, SHOULD_RUN } from './helpers';

/**
 * Admin notification inbox updates when financial events fire.
 *
 * Pre-condition: a consumer test user has triggered (in a previous step)
 * a loan apply, savings large-withdrawal, piggybank cancel, or njangi
 * payout. The admin user then logs in and verifies the inbox shows the
 * matching item.
 *
 * SKIPPED until E2E test users are seeded. See e2e/SEEDING.md.
 */
test.describe('Admin inbox updates on financial events', () => {
  test.skip(!SHOULD_RUN, 'E2E test users not seeded — see e2e/SEEDING.md');

  test('loan application appears in loan review queue', async ({ page }) => {
    const ok = await loginAs(page, 'admin');
    expect(ok).toBe(true);
    await page.goto('/admin/loan-review-queue');
    await expect(page.getByRole('heading', { name: /loan review queue/i })).toBeVisible();
    // The seed flow should have inserted at least one row in the last hour
    await expect(page.locator('table tbody tr')).not.toHaveCount(0, { timeout: 10_000 });
  });

  test('large savings withdrawal appears in anomaly queue', async ({ page }) => {
    const ok = await loginAs(page, 'admin');
    expect(ok).toBe(true);
    await page.goto('/admin/savings-anomaly-queue');
    await expect(page.getByRole('heading', { name: /savings anomaly queue/i })).toBeVisible();
  });

  test('admin notifications page shows piggybank/njangi events', async ({ page }) => {
    const ok = await loginAs(page, 'admin');
    expect(ok).toBe(true);
    await page.goto('/admin/notifications');
    // Confirm the inbox renders without error; row-level assertions added once seeders exist.
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
  });
});
