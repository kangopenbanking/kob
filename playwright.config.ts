import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 4 — UI E2E smoke harness for KOB dashboards.
 *
 * Runs lightweight "page loads with no console error" checks against every
 * dashboard layout root. Authenticated flows are intentionally NOT in scope
 * for the smoke layer — they are added per-dashboard in follow-on suites.
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://kob.lovable.app npx playwright test
 *   (defaults to the published URL when env var is not provided)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://kob.lovable.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
