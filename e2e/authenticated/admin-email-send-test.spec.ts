/**
 * E2E: Admin email Send Test CTAs across the email-management pages.
 *
 * Verifies that clicking the live "Send Test" controls on
 *   /admin/email-templates
 *   /admin/managed-emails
 *   /admin/communications
 *   /admin/email-provider-settings
 * dispatches via the Resend-first provider and surfaces a successful
 * live delivery result (no errors).
 *
 * Skipped unless E2E_PASSWORD + E2E_ADMIN_EMAIL are seeded — see e2e/SEEDING.md.
 */
import { expect, test } from '@playwright/test';
import { SHOULD_RUN, loginAs } from './helpers';

test.describe('Admin email Send Test CTAs', () => {
  test.skip(!SHOULD_RUN, 'E2E auth env not configured');

  test.beforeEach(async ({ page }) => {
    const ok = await loginAs(page, 'admin');
    test.skip(!ok, 'admin login unavailable');
  });

  test('Email Provider Settings — live delivery via Resend', async ({ page }) => {
    await page.goto('/admin/email-provider-settings');
    await page.getByPlaceholder(/test@example\.com/i).fill('kangopenbanking@gmail.com');
    await page.getByRole('button', { name: /send test email/i }).click();
    const panel = page.getByTestId('provider-send-test-result');
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel).toHaveAttribute('data-success', 'true');
    await expect(panel).toHaveAttribute('data-provider', 'resend');
  });

  test('Communications — per-template Send Test via Resend', async ({ page }) => {
    await page.goto('/admin/communications');
    const firstTest = page.locator('[data-testid^="send-test-"]').first();
    await expect(firstTest).toBeVisible({ timeout: 15_000 });
    const key = (await firstTest.getAttribute('data-testid'))!.replace('send-test-', '');
    await firstTest.click();
    const result = page.getByTestId(`send-test-result-${key}`);
    await expect(result).toBeVisible({ timeout: 20_000 });
    await expect(result).toHaveAttribute('data-success', 'true');
    await expect(result).toHaveAttribute('data-provider', 'resend');
  });

  test('Email Templates — Send Test dialog returns sent via Resend', async ({ page }) => {
    await page.goto('/admin/email-templates');
    await page.getByRole('button', { name: /send test email/i }).first().click();
    await page.getByRole('button', { name: /^send test$/i }).click();
    await expect(page.getByText(/sent/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/resend/i).first()).toBeVisible();
  });

  test('Managed Emails — first active template Send Test succeeds', async ({ page }) => {
    await page.goto('/admin/managed-emails');
    await page.getByTitle(/send test email/i).first().click();
    // Submit the dialog (defaults to admin's own inbox)
    await page.getByRole('button', { name: /^send( test)?$/i }).last().click();
    await expect(page.getByText(/sent|delivered/i).first()).toBeVisible({ timeout: 25_000 });
  });
});
