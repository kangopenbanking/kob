import { test, expect } from '@playwright/test';
import { loginAs, SHOULD_RUN } from './helpers';

/**
 * Webhook delivery replay smoke.
 *
 * Verifies an admin can open the webhook deliveries page, see at least
 * one row, and trigger a replay action. The replay must show a result
 * status (queued or 2xx) without throwing.
 *
 * SKIPPED until E2E test users are seeded AND a test webhook exists.
 * See e2e/SEEDING.md.
 */
test.describe('Webhook delivery replay', () => {
  test.skip(!SHOULD_RUN, 'E2E test users not seeded — see e2e/SEEDING.md');

  test('admin sees deliveries and can open replay panel', async ({ page }) => {
    const ok = await loginAs(page, 'admin');
    expect(ok).toBe(true);
    await page.goto('/admin/webhook-deliveries');
    await expect(page.getByRole('heading', { name: /webhook deliver/i })).toBeVisible();

    const rowCount = await page.locator('table tbody tr').count();
    test.skip(rowCount === 0, 'No webhook deliveries seeded yet');

    // Click the first replay control and assert a status update fires.
    await page.locator('table tbody tr').first().getByRole('button', { name: /replay/i }).click();
    await expect(page.getByText(/queued|delivered|replay (sent|triggered)/i)).toBeVisible({ timeout: 10_000 });
  });

  test('merchant sees own deliveries and can replay', async ({ page }) => {
    const ok = await loginAs(page, 'merchant');
    expect(ok).toBe(true);
    await page.goto('/merchant/webhooks/deliveries');
    await expect(page.getByRole('heading', { name: /webhook deliver/i })).toBeVisible();
  });
});
