import { test, expect } from '@playwright/test';
import { loginAs, SHOULD_RUN } from './helpers';

/**
 * KYB visibility — when a merchant submits KYB, an admin must see it in
 * /admin/kyb-review-queue immediately.
 *
 * SKIPPED until E2E test users are seeded. See e2e/SEEDING.md.
 */
test.describe('KYB visibility per dashboard role', () => {
  test.skip(!SHOULD_RUN, 'E2E test users not seeded — see e2e/SEEDING.md');

  test('admin sees KYB review queue', async ({ page }) => {
    const ok = await loginAs(page, 'admin');
    expect(ok, 'admin login failed').toBe(true);
    await page.goto('/admin/kyb-review-queue');
    await expect(page.getByRole('heading', { name: /kyb review queue/i })).toBeVisible();
  });

  test('merchant sees their KYB status', async ({ page }) => {
    const ok = await loginAs(page, 'merchant');
    expect(ok, 'merchant login failed').toBe(true);
    await page.goto('/merchant/kyb');
    await expect(page).toHaveURL(/\/merchant\/kyb/);
  });

  test('bank staff see customer KYC list', async ({ page }) => {
    const ok = await loginAs(page, 'institution');
    expect(ok, 'bank login failed').toBe(true);
    await page.goto('/fi-portal/kyc');
    await expect(page).toHaveURL(/\/fi-portal\/kyc/);
  });

  test('consumer sees personal dashboard', async ({ page }) => {
    const ok = await loginAs(page, 'consumer');
    expect(ok, 'consumer login failed').toBe(true);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
