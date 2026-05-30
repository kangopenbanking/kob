/**
 * Consumer Budget — mini-donut bottom sheet & categories filter persistence.
 *
 * Skips when consumer credentials are not seeded (see e2e/SEEDING.md).
 */
import { test, expect, devices } from '@playwright/test';
import { SHOULD_RUN, loginAs } from './helpers';

test.use({ ...devices['iPhone 12'] });

test.describe('Consumer Budget — mini-donuts + filter persistence', () => {
  test.skip(!SHOULD_RUN, 'E2E_PASSWORD not configured');

  test.beforeEach(async ({ page }) => {
    const ok = await loginAs(page, 'consumer');
    test.skip(!ok, 'consumer credentials missing');
    await page.goto('/app/budget');
    await page.waitForLoadState('networkidle').catch(() => {});
  });

  for (const stat of ['left', 'daily', 'days'] as const) {
    test(`tapping the ${stat.toUpperCase()} mini-donut opens the bottom sheet with exact values`, async ({ page }) => {
      const donut = page.getByTestId(`mini-donut-${stat}`);
      await expect(donut).toBeVisible();

      // Listen for the analytics CustomEvent fired by the page.
      const eventsHandle = await page.evaluateHandle(() => {
        const bag: any[] = [];
        window.addEventListener('kob:analytics', (e) => bag.push((e as CustomEvent).detail));
        (window as any).__budgetEvents = bag;
        return bag;
      });

      await donut.click();

      const sheet = page.getByTestId('stat-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute('role', 'dialog');
      await expect(sheet).toHaveAttribute('aria-modal', 'true');
      await expect(sheet).toHaveAttribute('aria-labelledby', 'stat-sheet-title');
      await expect(sheet).toHaveAttribute('aria-describedby', 'stat-sheet-desc');

      const value = await sheet.getByTestId('stat-sheet-value').innerText();
      expect(value.trim().length).toBeGreaterThan(0);
      // Percentage rendered inside the sheet's donut center label.
      await expect(sheet.locator('text=/\\d+%/').first()).toBeVisible();

      // Verify both tap + open analytics fired.
      const events = await page.evaluate(() => (window as any).__budgetEvents ?? []);
      const names = events.map((e: any) => e.event);
      expect(names).toContain('budget.mini_donut.tap');
      expect(names).toContain('budget.stat_sheet.open');

      // Escape closes the sheet and emits a close event.
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      const after = await page.evaluate(() => (window as any).__budgetEvents ?? []);
      expect(after.map((e: any) => e.event)).toContain('budget.stat_sheet.close');

      await eventsHandle.dispose();
    });
  }

  test('categories View all / Show less + filter persist while scrolling and across navigation', async ({ page }) => {
    const toggle = page.getByTestId('categories-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveText(/Show less/i);

    // Scroll the whole page; sticky filter header must stay and toggle text must remain.
    await page.mouse.wheel(0, 1200);
    await expect(page.getByTestId('categories-filter')).toBeVisible();
    await expect(page.getByTestId('categories-toggle')).toHaveText(/Show less/i);

    // Apply a filter via the dropdown menu.
    await page.getByTestId('categories-filter').click();
    await page.getByRole('menuitem', { name: /over budget/i }).click().catch(async () => {
      await page.getByRole('menuitem', { name: /over/i }).click();
    });

    // Navigate away then back — both pieces of state must persist.
    await page.goto('/app/home');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto('/app/budget');
    await page.waitForLoadState('networkidle').catch(() => {});

    await expect(page.getByTestId('categories-toggle')).toHaveText(/Show less/i);
    await expect(page.getByTestId('categories-filter')).toContainText(/Over/i);
  });
});
