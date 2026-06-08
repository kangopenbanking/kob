/**
 * E2E: Nium name-correction managed email trio (submitted → approved/rejected).
 *
 * Drives the full maker–checker lifecycle on the deployed
 * `nium-request-name-correction` edge function with three test identities
 * (customer / compliance maker / admin checker) and asserts that the
 * branded managed emails for SUBMITTED, APPROVED, and REJECTED events
 * land in `email_send_log` against the verified Lovable/Resend domain.
 *
 * Skipped unless the following env is configured:
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY, E2E_SUPABASE_SERVICE_ROLE_KEY
 *   E2E_CUSTOMER_EMAIL/_PASSWORD/_USER_ID
 *   E2E_COMPLIANCE_EMAIL/_PASSWORD  (must have compliance_officer role)
 *   E2E_ADMIN_EMAIL/_PASSWORD       (must have admin role)
 *
 * See e2e/SEEDING.md for setup.
 */
import { test, expect } from '@playwright/test';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const ANON = process.env.E2E_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;

const CUSTOMER_EMAIL = process.env.E2E_CUSTOMER_EMAIL ?? process.env.E2E_CONSUMER_EMAIL;
const CUSTOMER_PWD = process.env.E2E_CUSTOMER_PASSWORD ?? process.env.E2E_PASSWORD;
const COMPLIANCE_EMAIL = process.env.E2E_COMPLIANCE_EMAIL;
const COMPLIANCE_PWD = process.env.E2E_COMPLIANCE_PASSWORD ?? process.env.E2E_PASSWORD;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PWD = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_PASSWORD;

const SHOULD_RUN = !!(
  SUPABASE_URL && ANON && SERVICE &&
  CUSTOMER_EMAIL && CUSTOMER_PWD &&
  COMPLIANCE_EMAIL && COMPLIANCE_PWD &&
  ADMIN_EMAIL && ADMIN_PWD
);

async function signIn(email: string, pwd: string): Promise<SupabaseClient> {
  const c = createClient(SUPABASE_URL!, ANON!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: pwd });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

async function pollEmailLog(
  admin: SupabaseClient,
  recipient: string,
  templateKey: string,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { data } = await admin
      .from('email_send_log')
      .select('template_name, status, recipient_email, created_at')
      .eq('recipient_email', recipient)
      .eq('template_name', templateKey)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) return data[0];
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}

test.describe('Nium name-correction managed email trio', () => {
  test.skip(!SHOULD_RUN, 'E2E name-correction trio env not configured');

  test('SUBMITTED + APPROVED emails land in email_send_log', async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE!, { auth: { persistSession: false } });

    // 1. Customer submits a correction
    const customer = await signIn(CUSTOMER_EMAIL!, CUSTOMER_PWD!);
    const requestedName = `E2E Tester ${Date.now()}`;
    const { data: submitData, error: submitErr } = await customer.functions.invoke(
      'nium-request-name-correction',
      {
        body: {
          action: 'submit',
          requested_full_name: requestedName,
          reason: 'E2E test for managed email trio coverage on approval path.',
          document_type: 'passport',
          document_front_url: 'e2e/fixtures/passport-front.jpg',
        },
      },
    );
    expect(submitErr, submitErr?.message).toBeNull();
    const requestId = (submitData as any)?.request?.id as string;
    expect(requestId).toBeTruthy();

    // Assert SUBMITTED email
    const submittedRow = await pollEmailLog(admin, CUSTOMER_EMAIL!, 'nium_name_correction_submitted');
    expect(submittedRow, 'no submitted email logged').not.toBeNull();
    expect(['pending', 'sent']).toContain(submittedRow!.status);

    // 2. Compliance maker proposes approval
    const maker = await signIn(COMPLIANCE_EMAIL!, COMPLIANCE_PWD!);
    const { error: makerErr } = await maker.functions.invoke('nium-request-name-correction', {
      body: { action: 'decide', request_id: requestId, stage: 'maker', decision: 'approved' },
    });
    expect(makerErr, makerErr?.message).toBeNull();

    // 3. Admin checker finalises approval
    const checker = await signIn(ADMIN_EMAIL!, ADMIN_PWD!);
    const { error: checkerErr } = await checker.functions.invoke('nium-request-name-correction', {
      body: { action: 'decide', request_id: requestId, stage: 'checker', decision: 'approved' },
    });
    expect(checkerErr, checkerErr?.message).toBeNull();

    // Assert APPROVED email
    const approvedRow = await pollEmailLog(admin, CUSTOMER_EMAIL!, 'nium_name_correction_approved');
    expect(approvedRow, 'no approved email logged').not.toBeNull();
    expect(['pending', 'sent']).toContain(approvedRow!.status);
  });

  test('REJECTED email lands in email_send_log', async () => {
    const admin = createClient(SUPABASE_URL!, SERVICE!, { auth: { persistSession: false } });

    const customer = await signIn(CUSTOMER_EMAIL!, CUSTOMER_PWD!);
    const { data: submitData, error: submitErr } = await customer.functions.invoke(
      'nium-request-name-correction',
      {
        body: {
          action: 'submit',
          requested_full_name: `E2E Reject ${Date.now()}`,
          reason: 'E2E test for managed email trio coverage on rejection path.',
          document_type: 'passport',
          document_front_url: 'e2e/fixtures/passport-front.jpg',
        },
      },
    );
    expect(submitErr, submitErr?.message).toBeNull();
    const requestId = (submitData as any)?.request?.id as string;
    expect(requestId).toBeTruthy();

    const maker = await signIn(COMPLIANCE_EMAIL!, COMPLIANCE_PWD!);
    await maker.functions.invoke('nium-request-name-correction', {
      body: { action: 'decide', request_id: requestId, stage: 'maker', decision: 'rejected' },
    });

    const checker = await signIn(ADMIN_EMAIL!, ADMIN_PWD!);
    const { error: checkerErr } = await checker.functions.invoke('nium-request-name-correction', {
      body: {
        action: 'decide',
        request_id: requestId,
        stage: 'checker',
        decision: 'rejected',
        decision_note: 'Documents not legible — E2E coverage path.',
      },
    });
    expect(checkerErr, checkerErr?.message).toBeNull();

    const rejectedRow = await pollEmailLog(admin, CUSTOMER_EMAIL!, 'nium_name_correction_rejected');
    expect(rejectedRow, 'no rejected email logged').not.toBeNull();
    expect(['pending', 'sent']).toContain(rejectedRow!.status);
  });
});
