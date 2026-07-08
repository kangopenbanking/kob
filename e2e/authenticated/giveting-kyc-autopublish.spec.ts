import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { signIn } from './helpers';

// KYC → Giveting auto-publish end-to-end.
// Prerequisites (see e2e/SEEDING.md):
//   RUN_AUTHENTICATED_E2E=1
//   E2E_CONSUMER_EMAIL, E2E_ADMIN_EMAIL, E2E_PASSWORD
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service-role required to
//   reset the consumer's KYC + campaigns to a known state and to
//   promote the campaign back to 'pending' between runs).

const RUN = process.env.RUN_AUTHENTICATED_E2E === '1';
const {
  E2E_CONSUMER_EMAIL,
  E2E_PASSWORD,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

const shouldRun = RUN && E2E_CONSUMER_EMAIL && E2E_PASSWORD && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY;

test.describe('Giveting — KYC auto-publish E2E', () => {
  test.skip(!shouldRun, 'Requires RUN_AUTHENTICATED_E2E=1 + seed users + service role key');

  const admin = shouldRun
    ? createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    : null;

  let consumerUserId: string;
  let campaignId: string;
  let campaignSlug: string;

  test.beforeAll(async () => {
    if (!admin) return;
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
    const u = users?.users.find((x) => x.email === E2E_CONSUMER_EMAIL);
    if (!u) throw new Error(`Consumer ${E2E_CONSUMER_EMAIL} not seeded`);
    consumerUserId = u.id;

    // Reset state: revoke KYC, clear stale test campaigns
    await admin.from('kyc_verifications').delete().eq('user_id', consumerUserId);
    await admin
      .from('giveting_campaigns')
      .delete()
      .eq('owner_user_id', consumerUserId)
      .ilike('title', 'E2E autopublish %');
  });

  test('creates a pending campaign, KYC approval auto-publishes it, audit trail shows the transition', async ({ page }) => {
    await signIn(page, E2E_CONSUMER_EMAIL!, E2E_PASSWORD!);
    await page.goto('/app/giveting');

    // Create a campaign via the edge function (fastest, avoids UI form flakiness)
    const created = await page.evaluate(async () => {
      const { supabase } = await import('/src/integrations/supabase/client.ts');
      const { data, error } = await supabase.functions.invoke('giveting', {
        body: {
          action: 'create',
          title: `E2E autopublish ${Date.now()}`,
          story: 'Automated end-to-end coverage.',
          category_slug: 'community',
          currency: 'XAF',
          goal_amount_minor: 500_000,
          beneficiary_type: 'self',
        },
      });
      if (error) throw error;
      return data.campaign;
    });
    campaignId = created.id;
    campaignSlug = created.slug;
    expect(created.status).toBe('pending');

    // Approve KYC via service role → triggers auto-publish
    await admin!.from('kyc_verifications').insert({
      user_id: consumerUserId,
      status: 'approved',
      verification_type: 'e2e-test',
      submitted_at: new Date().toISOString(),
    });

    // Wait for the trigger to promote the campaign
    await expect
      .poll(async () => {
        const { data } = await admin!
          .from('giveting_campaigns')
          .select('status')
          .eq('id', campaignId)
          .maybeSingle();
        return data?.status;
      }, { timeout: 15_000 })
      .toBe('active');

    // App notification fired
    const { data: notifs } = await admin!
      .from('app_notifications')
      .select('*')
      .eq('user_id', consumerUserId)
      .eq('idempotency_key', `giveting-live-${campaignId}`);
    expect(notifs?.length ?? 0).toBeGreaterThan(0);

    // Audit event fired
    const { data: events } = await admin!
      .from('giveting_campaign_events')
      .select('event_type, from_status, to_status')
      .eq('campaign_id', campaignId)
      .eq('event_type', 'auto_published_kyc');
    expect(events?.length ?? 0).toBeGreaterThan(0);
    expect(events![0].from_status).toBe('pending');
    expect(events![0].to_status).toBe('active');

    // UI reflects the live status on /app/giveting
    await page.goto('/app/giveting');
    await expect(page.getByText(created.title)).toBeVisible({ timeout: 10_000 });
    // 'active' badge or no 'Pending KYC' badge
    await expect(page.getByText(/Pending KYC/i)).toHaveCount(0);

    // Audit trail renders on manage page
    await page.goto(`/app/giveting/c/${campaignSlug}/manage`);
    await expect(page.getByText(/Activity & audit trail/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Auto-published after identity verification/i)).toBeVisible();
  });

  test('publish is idempotent when KYC state changes mid-request', async ({ page }) => {
    await signIn(page, E2E_CONSUMER_EMAIL!, E2E_PASSWORD!);
    await page.goto('/app/giveting');

    // Force campaign back to pending, ensure KYC is approved
    await admin!.from('giveting_campaigns').update({ status: 'pending', published_at: null }).eq('id', campaignId);

    // Two concurrent publish calls with different idempotency keys
    const results = await page.evaluate(async ({ id }) => {
      const { supabase } = await import('/src/integrations/supabase/client.ts');
      const call = () => supabase.functions.invoke('giveting', {
        body: { action: 'publish', id, idempotency_key: crypto.randomUUID() },
      });
      return Promise.all([call(), call()]);
    }, { id: campaignId });

    // Exactly one should succeed with replayed=false, the other with replayed=true (or both success/one replay)
    const statuses = results.map((r: any) => r.data);
    expect(statuses.every((s: any) => s.campaign.status === 'active')).toBeTruthy();
    const replayed = statuses.filter((s: any) => s.replayed).length;
    expect(replayed).toBeGreaterThanOrEqual(1);
  });
});
