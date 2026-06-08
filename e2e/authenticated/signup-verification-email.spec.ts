/**
 * E2E: Signup verification email delivery.
 *
 * Triggers a Supabase Auth signup with a unique address and asserts that
 * the branded confirmation email (sent via the verified Lovable/Resend
 * domain `notify.kangopenbanking.com`) is recorded in `email_send_log`
 * with template_name='signup' and a non-failed status.
 *
 * Skipped unless E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, and
 * E2E_SUPABASE_SERVICE_ROLE_KEY are configured (the service role key is
 * needed to read `email_send_log` and to clean up the test user).
 *
 * See e2e/SEEDING.md for the broader auth-test setup.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

const SHOULD_RUN = !!(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

test.describe('Auth signup verification email', () => {
  test.skip(!SHOULD_RUN, 'E2E Supabase env not configured');

  test('signup enqueues a branded confirmation email recorded in email_send_log', async () => {
    const anon = createClient(SUPABASE_URL!, ANON_KEY!);
    const admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const uniq = `e2e-signup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `${uniq}@kob.test`;
    const password = `Test-${uniq}-Pwd!`;

    // 1. Trigger Supabase Auth signup -> auth-email-hook fires -> queue -> Resend
    const { data: signUpData, error: signUpErr } = await anon.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: 'https://kangopenbanking.com/auth/callback' },
    });

    expect(signUpErr, signUpErr?.message).toBeNull();
    expect(signUpData.user?.email).toBe(email);

    // 2. Poll email_send_log for a row matching this recipient + signup template
    let row: { template_name: string; status: string; message_id: string | null } | null = null;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const { data, error } = await admin
        .from('email_send_log')
        .select('template_name, status, message_id, created_at')
        .eq('recipient_email', email)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) {
        row = data[0] as typeof row;
        break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    expect(row, 'no email_send_log row found for signup verification').not.toBeNull();
    expect(row!.template_name).toBe('signup');
    // Acceptable terminal/in-flight statuses; we explicitly reject dlq/failed/suppressed.
    expect(['pending', 'sent']).toContain(row!.status);

    // 3. Cleanup — remove the test user (best-effort)
    if (signUpData.user?.id) {
      await admin.auth.admin.deleteUser(signUpData.user.id).catch(() => {});
    }
  });
});
