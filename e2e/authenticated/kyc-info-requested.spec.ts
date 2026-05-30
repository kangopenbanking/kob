/**
 * KYC info_requested → persistent dashboard banner.
 *
 * Skipped automatically until E2E credentials are seeded
 * (see e2e/SEEDING.md). When enabled, the spec:
 *   1. Signs in as the admin and marks the consumer's pending KYC as
 *      `info_requested` via the admin-kyc-review edge function.
 *   2. Signs in as the consumer.
 *   3. Asserts the persistent KYC banner is rendered on the customer
 *      dashboard and survives a reload (non-dismissible for info_requested).
 *   4. Navigates to the banking app layout and asserts the same banner
 *      is present there too (banner is wired into both layouts).
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import { getCreds, loginAs, SHOULD_RUN } from './helpers';

test.describe('KYC info_requested banner persistence', () => {
  test.skip(!SHOULD_RUN, 'Authenticated suite disabled — see e2e/SEEDING.md');

  test('marks pending KYC as info_requested and banner persists across layouts', async ({ page, baseURL }) => {
    const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
    const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    test.skip(!SUPABASE_URL || !ANON_KEY, 'Supabase env not configured for E2E');

    const adminCreds = getCreds('admin');
    const consumerCreds = getCreds('consumer');
    test.skip(!adminCreds || !consumerCreds, 'Missing admin/consumer creds');

    const api = await pwRequest.newContext();

    // 1. Admin sign-in via REST → token
    const tokenRes = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY! },
      data: { email: adminCreds!.email, password: adminCreds!.password },
    });
    expect(tokenRes.ok()).toBeTruthy();
    const adminToken = (await tokenRes.json()).access_token as string;

    const consumerTokenRes = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY! },
      data: { email: consumerCreds!.email, password: consumerCreds!.password },
    });
    const consumerToken = (await consumerTokenRes.json()).access_token as string;
    const meRes = await api.get(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${consumerToken}`, apikey: ANON_KEY! },
    });
    const consumerId = (await meRes.json()).id as string;

    // 2. Ensure a pending KYC exists for the consumer
    const findRes = await api.get(
      `${SUPABASE_URL}/rest/v1/kyc_verifications?select=id,status&user_id=eq.${consumerId}&status=eq.pending&order=created_at.desc&limit=1`,
      { headers: { Authorization: `Bearer ${adminToken}`, apikey: ANON_KEY! } },
    );
    let pending = (await findRes.json())[0] as { id: string } | undefined;
    if (!pending) {
      const ins = await api.post(`${SUPABASE_URL}/rest/v1/kyc_verifications`, {
        headers: {
          Authorization: `Bearer ${consumerToken}`,
          apikey: ANON_KEY!,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        data: {
          user_id: consumerId,
          document_type: 'national_id',
          document_number: `E2E-${Date.now()}`,
          status: 'pending',
        },
      });
      const created = await ins.json();
      pending = Array.isArray(created) ? created[0] : created;
    }
    expect(pending?.id).toBeTruthy();

    // 3. Admin marks it as info_requested
    const reviewRes = await api.post(`${SUPABASE_URL}/functions/v1/admin-kyc-review`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        apikey: ANON_KEY!,
        'Content-Type': 'application/json',
      },
      data: {
        kyc_id: pending!.id,
        action: 'info_requested',
        info_request_message: 'Please upload a clearer ID photo and a fresh selfie.',
      },
    });
    expect(reviewRes.status(), await reviewRes.text()).toBe(200);

    // 4. Consumer logs in to the UI and sees the persistent banner on customer dashboard
    const loggedIn = await loginAs(page, 'consumer');
    test.skip(!loggedIn, 'Consumer login failed');

    await page.goto('/home');
    const banner = page.getByRole('status').filter({ hasText: /additional information/i });
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // Non-dismissible for info_requested — no close button rendered
    await expect(banner.getByRole('button', { name: /dismiss/i })).toHaveCount(0);

    // 5. Survives a reload
    await page.reload();
    await expect(banner).toBeVisible({ timeout: 10_000 });

    // 6. Banking app layout shows the same banner
    await page.goto('/bank');
    const bankBanner = page.getByRole('status').filter({ hasText: /additional information/i });
    await expect(bankBanner).toBeVisible({ timeout: 10_000 });
  });
});
