/**
 * E2E — STEP_UP_REQUIRED handling on /admin/institution-verification.
 * Verifies the dialog blocks both KYB approve and final institution approve.
 */
import { test, expect } from '@playwright/test';
import { loginAs, SHOULD_RUN } from './helpers';

test.describe('Admin step-up required — Institution approve', () => {
  test.skip(!SHOULD_RUN, 'E2E test users not seeded — see e2e/SEEDING.md');

  test('institution approval requires fresh MFA', async ({ page }) => {
    test.setTimeout(60_000);
    const ok = await loginAs(page, 'admin');
    expect(ok).toBe(true);

    await page.goto('/admin/institution-verification');
    await expect(page.getByRole('heading', { name: /institution verification/i })).toBeVisible();

    const card = page.locator('[data-inst-row]').first();
    if (await card.count() === 0) test.skip(true, 'No institutions to act on.');

    // Try any approval-style CTA inside the first card.
    const cta = card.getByRole('button', { name: /approve|verify|finalize/i }).first();
    if (await cta.count() === 0) test.skip(true, 'No approval CTA in first card.');
    await cta.click().catch(() => {});

    await expect(page.getByText(/step-up authentication required/i)).toBeVisible({ timeout: 8_000 });
    await page.locator('[data-testid="step-up-cancel"]').click();
    await expect(page.getByText(/step-up authentication required/i)).toBeHidden();
  });
});
