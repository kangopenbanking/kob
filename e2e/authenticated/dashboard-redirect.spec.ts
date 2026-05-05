/**
 * Phase 6 — Sign-in dashboard redirect E2E.
 *
 * Logs in as each seeded role and asserts that DashboardRouter lands the
 * user on the correct dashboard path. Skips when seed credentials are
 * missing (see e2e/SEEDING.md).
 *
 * Required env vars:
 *   E2E_PASSWORD                  shared password for all seed accounts
 *   E2E_ADMIN_EMAIL               → expects /admin
 *   E2E_MERCHANT_EMAIL            → expects /merchant
 *   E2E_INSTITUTION_EMAIL         → expects /fi-portal
 *   E2E_DEVELOPER_EMAIL           → expects /developer
 *   E2E_DEVELOPER_ORG_EMAIL       → expects /developer (role from dev_org row)
 *   E2E_CONSUMER_EMAIL            → expects /credit-score
 */
import { test, expect, type Page } from '@playwright/test';
import { SHOULD_RUN } from './helpers';

type Cohort = {
  label: string;
  emailEnv: string;
  expectedPath: RegExp;
};

const COHORTS: Cohort[] = [
  { label: 'admin',        emailEnv: 'E2E_ADMIN_EMAIL',         expectedPath: /^\/admin/ },
  { label: 'merchant',     emailEnv: 'E2E_MERCHANT_EMAIL',      expectedPath: /^\/merchant/ },
  { label: 'institution',  emailEnv: 'E2E_INSTITUTION_EMAIL',   expectedPath: /^\/fi-portal/ },
  { label: 'developer',    emailEnv: 'E2E_DEVELOPER_EMAIL',     expectedPath: /^\/developer/ },
  { label: 'developer_org',emailEnv: 'E2E_DEVELOPER_ORG_EMAIL', expectedPath: /^\/developer/ },
  { label: 'consumer',     emailEnv: 'E2E_CONSUMER_EMAIL',      expectedPath: /^\/credit-score/ },
];

async function login(page: Page, email: string, password: string) {
  await page.goto('/auth');
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click();
  // Wait for redirect away from /auth (DashboardRouter does navigate(replace))
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20_000 });
}

test.describe('DashboardRouter — landing path per cohort', () => {
  test.skip(!SHOULD_RUN, 'E2E credentials not provided (see e2e/SEEDING.md)');

  for (const c of COHORTS) {
    test(`${c.label} lands on ${c.expectedPath}`, async ({ page }) => {
      const email = process.env[c.emailEnv];
      const password = process.env.E2E_PASSWORD;
      test.skip(!email || !password, `Missing ${c.emailEnv}`);

      await login(page, email!, password!);
      const path = new URL(page.url()).pathname;
      expect(path, `cohort ${c.label} landed on ${path}`).toMatch(c.expectedPath);
    });
  }
});
