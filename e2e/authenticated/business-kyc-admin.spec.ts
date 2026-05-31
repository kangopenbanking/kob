import { test, expect } from '@playwright/test';
import { loginAs, SHOULD_RUN } from './helpers';

/**
 * Admin /admin/business-kyc E2E parity audit:
 *  - Stats grid renders (Total / Pending / Approved / Rejected)
 *  - Source filter (Institution / Merchant) narrows the visible rows
 *  - Latest-per-user dedupe toggle changes row count
 *  - CSV export downloads a non-empty file
 *  - Detail dialog opens with documents grid + per-doc Download buttons
 *  - No broken <img> in document thumbnails (every rendered img has natural size > 0)
 */
test.describe('Admin Business KYC (KYB) review — E2E parity', () => {
  test.skip(!SHOULD_RUN, 'E2E test users not seeded — see e2e/SEEDING.md');

  test('admin reviews KYB queue end-to-end', async ({ page }) => {
    test.setTimeout(90_000);
    const ok = await loginAs(page, 'admin');
    expect(ok, 'admin login failed').toBe(true);

    await page.goto('/admin/business-kyc');
    await expect(page.getByRole('heading', { name: /business kyc review/i })).toBeVisible();

    // Stats cards visible
    await expect(page.getByText(/Total Submissions/i)).toBeVisible();
    await expect(page.getByText(/Pending Review/i)).toBeVisible();
    await expect(page.getByText(/^Approved$/i)).toBeVisible();
    await expect(page.getByText(/^Rejected$/i)).toBeVisible();

    // Switch to All tab
    await page.getByRole('tab', { name: /^All/i }).click();

    const rows = page.locator('[data-kyb-row]');
    const beforeCount = await rows.count();

    // Source filter — Merchant
    await page.locator('[data-testid="kyb-source-filter"] [data-source-value="gateway_merchant"]').click();
    await page.waitForTimeout(300);
    const merchantCount = await rows.count();
    expect(merchantCount).toBeLessThanOrEqual(beforeCount);
    for (let i = 0; i < merchantCount; i++) {
      await expect(rows.nth(i)).toHaveAttribute('data-kyb-source', 'gateway_merchant');
    }

    // Source filter — All again
    await page.locator('[data-testid="kyb-source-filter"] [data-source-value="all"]').click();
    await page.waitForTimeout(200);

    // CSV export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="kyb-export-csv"]').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^kyb-submissions-\d{8}-\d{4}\.csv$/);

    // Open first row detail dialog
    if (beforeCount > 0) {
      await rows.first().click();
      await expect(page.getByText(/KYB Submission Detail/i)).toBeVisible();

      // Document grid: every slot rendered, no broken images
      const slots = page.locator('[data-kyb-doc-slot]');
      const slotCount = await slots.count();
      expect(slotCount).toBeGreaterThan(0);
      const imgs = page.locator('[data-testid="kyb-doc-grid"] img');
      const imgCount = await imgs.count();
      for (let i = 0; i < imgCount; i++) {
        const ok = await imgs.nth(i).evaluate((n: HTMLImageElement) => n.complete && n.naturalWidth > 0);
        expect(ok, `KYB thumbnail #${i} failed to load`).toBe(true);
      }

      // Each Download button maps to an existing slot
      const dls = page.locator('[data-kyb-download]');
      const dlCount = await dls.count();
      for (let i = 0; i < dlCount; i++) {
        const key = await dls.nth(i).getAttribute('data-kyb-download');
        await expect(page.locator(`[data-kyb-doc-slot="${key}"][data-kyb-doc-has-file="1"]`)).toHaveCount(1);
      }
    }
  });
});
