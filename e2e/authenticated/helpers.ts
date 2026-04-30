/**
 * Authenticated E2E helpers.
 *
 * IMPORTANT: every spec under e2e/authenticated/ skips when the required
 * env vars are missing. See e2e/SEEDING.md for the setup steps.
 */
import type { Page } from '@playwright/test';

export const ROLES = ['admin', 'merchant', 'institution', 'consumer'] as const;
export type Role = typeof ROLES[number];

export function getCreds(role: Role): { email: string; password: string } | null {
  const password = process.env.E2E_PASSWORD;
  if (!password) return null;
  const email =
    role === 'admin' ? process.env.E2E_ADMIN_EMAIL :
    role === 'merchant' ? process.env.E2E_MERCHANT_EMAIL :
    role === 'institution' ? (process.env.E2E_INSTITUTION_EMAIL ?? process.env.E2E_BANK_EMAIL) :
    process.env.E2E_CONSUMER_EMAIL;
  if (!email) return null;
  return { email, password };
}

export async function loginAs(page: Page, role: Role): Promise<boolean> {
  const creds = getCreds(role);
  if (!creds) return false;
  await page.goto('/auth');
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  return !page.url().includes('/auth');
}

export const SHOULD_RUN = !!process.env.E2E_PASSWORD || process.env.RUN_AUTHENTICATED_E2E === '1';
