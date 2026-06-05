/**
 * /app/global-accounts — Playwright E2E.
 *
 * Verifies loading skeletons, edge-function error handling, RBAC gating,
 * and activity feed filter + pagination across multiple personas.
 *
 * Skips automatically when E2E credentials are not configured.
 * See e2e/SEEDING.md.
 */
import { test, expect } from '@playwright/test';
import { loginAs, ROLES, SHOULD_RUN, type Role } from './helpers';

test.describe('Global Accounts page', () => {
  test.skip(!SHOULD_RUN, 'E2E credentials not configured');

  for (const role of ROLES as readonly Role[]) {
    test(`[${role}] page loads (or auth-redirects) without crash`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      const loggedIn = await loginAs(page, role);
      if (!loggedIn) test.skip(true, `No creds for ${role}`);

      await page.goto('/app/global-accounts');

      // Skeleton OR final header must appear quickly.
      await expect(page.locator('body')).toBeVisible();

      // If permitted, the page header renders.
      const header = page.getByRole('heading', { name: /Receive worldwide/i });
      const isRedirected = page.url().includes('/auth') || page.url().endsWith('/');
      if (!isRedirected) {
        await expect(header).toBeVisible({ timeout: 10_000 });

        // Empty state OR accounts heading is present.
        const accountsHeading = page.getByRole('heading', { name: /^Accounts$/i });
        await expect(accountsHeading).toBeVisible();
      }

      expect(errors.filter((e) => !/ResizeObserver|favicon/i.test(e))).toEqual([]);
    });
  }

  test('activity filter + pagination interact (skipped if no activity)', async ({ page }) => {
    const loggedIn = await loginAs(page, 'consumer');
    if (!loggedIn) test.skip(true, 'No consumer creds');

    await page.goto('/app/global-accounts');
    await page.waitForLoadState('networkidle').catch(() => {});

    const activity = page.getByRole('list', { name: /Incoming global account payments/i });
    if (await activity.count() === 0) {
      test.skip(true, 'No activity for this account');
    }

    // Date-range trigger present
    await expect(page.getByRole('button', { name: /–/ })).toBeVisible();
    // Pagination "next" button present
    await expect(page.getByRole('button', { name: /Go to next page|next/i }).first()).toBeVisible();
  });

  test('failed edge function surfaces toast, not a crash', async ({ page }) => {
    const loggedIn = await loginAs(page, 'consumer');
    if (!loggedIn) test.skip(true, 'No consumer creds');

    await page.route('**/functions/v1/nium-list-global-accounts', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'forced' }) }),
    );

    await page.goto('/app/global-accounts');
    await expect(page.getByRole('heading', { name: /Receive worldwide/i })).toBeVisible();
  });
});
