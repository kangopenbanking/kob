// Admin-only: send a preview of a managed email template to a chosen
// recipient (typically a support agent) with retry and provider callback
// diagnostics. Records every attempt in managed_email_test_sends and
// returns granular delivery info to the UI.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AttemptResult {
  ok: boolean;
  status: number;
  message_id: string | null;
  provider_callback_ok: boolean | null;
  error_message: string | null;
  provider_response: any;
}

async function attemptSend(
  admin: any,
  body: any,
  origin: string,
): Promise<AttemptResult> {
  try {
    const { data, error } = await admin.functions.invoke('managed-send-email', {
      body: {
        email_key: body.email_key,
        recipient_email: body.recipient_email,
        institution_id: body.institution_id,
        variables: {
          customer_name: 'Test Recipient',
          agent_name: 'Test Agent',
          department_name: 'Customer Support',
          subject: 'Sample subject for preview',
          customer: 'Test Customer',
          channel: 'website',
          portal_url: `${origin}/admin/support-chat`,
          currency: 'XAF',
          amount: '50,000',
          reference: 'TEST-PREVIEW',
          date: new Date().toLocaleDateString(),
          ...(body.variables || {}),
        },
      },
    });
    if (error) {
      return {
        ok: false,
        status: (error as any)?.context?.status || 502,
        message_id: null,
        provider_callback_ok: false,
        error_message: error.message || String(error),
        provider_response: { raw: error },
      };
    }
    const messageId = (data as any)?.message_id || (data as any)?.id || null;
    // Provider callback "ok" = downstream provider acknowledged the send.
    // managed-send-email returns delivered=true / provider_status when callback succeeded.
    const providerOk =
      (data as any)?.delivered === true ||
      (data as any)?.provider_status === 'queued' ||
      (data as any)?.provider_status === 'sent' ||
      !!messageId;
    return {
      ok: true,
      status: 200,
      message_id: messageId,
      provider_callback_ok: providerOk,
      error_message: providerOk ? null : 'Provider did not acknowledge delivery',
      provider_response: data ?? null,
    };
  } catch (e: any) {
    return {
      ok: false,
      status: 500,
      message_id: null,
      provider_callback_ok: false,
      error_message: e?.message || String(e),
      provider_response: { exception: String(e) },
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      email_key,
      recipient_email,
      variables = {},
      institution_id,
      max_attempts: rawAttempts = 1,
    } = body || {};
    const maxAttempts = Math.min(Math.max(parseInt(String(rawAttempts)) || 1, 1), 5);

    if (!email_key || !recipient_email) {
      return new Response(
        JSON.stringify({ error: 'email_key and recipient_email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const origin = new URL(req.url).origin.replace('functions.', '');

    // Pre-record the test send so it's visible even if every attempt fails
    const { data: testRow } = await admin
      .from('managed_email_test_sends')
      .insert({
        email_key,
        recipient_email,
        status: 'queued',
        sent_by: user.id,
        template_data: variables,
        attempt_count: 0,
      })
      .select()
      .single();

    let last: AttemptResult | null = null;
    let attempt = 0;
    const attempts: AttemptResult[] = [];

    while (attempt < maxAttempts) {
      attempt++;
      // Mark "retrying" between attempts
      if (testRow?.id && attempt > 1) {
        await admin
          .from('managed_email_test_sends')
          .update({
            status: 'retrying',
            attempt_count: attempt,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', testRow.id);
        // Exponential-ish backoff: 750ms, 1500ms, 3000ms ...
        await sleep(750 * Math.pow(2, attempt - 2));
      }

      last = await attemptSend(
        admin,
        { email_key, recipient_email, institution_id, variables },
        origin,
      );
      attempts.push(last);
      if (last.ok && last.provider_callback_ok) break;
    }

    const finalStatus: 'sent' | 'failed' = last?.ok && last.provider_callback_ok ? 'sent' : 'failed';

    if (testRow?.id) {
      await admin
        .from('managed_email_test_sends')
        .update({
          status: finalStatus,
          error_message: last?.error_message || null,
          message_id: last?.message_id || null,
          http_status: last?.status || null,
          provider_response: last?.provider_response || null,
          provider_callback_ok: last?.provider_callback_ok ?? null,
          attempt_count: attempt,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', testRow.id);
    }

    return new Response(
      JSON.stringify({
        success: finalStatus === 'sent',
        status: finalStatus,
        error: last?.error_message || null,
        http_status: last?.status || null,
        provider_callback_ok: last?.provider_callback_ok ?? false,
        provider_response: last?.provider_response || null,
        message_id: last?.message_id || null,
        attempts: attempt,
        max_attempts: maxAttempts,
        attempt_log: attempts.map((a) => ({
          ok: a.ok,
          status: a.status,
          provider_callback_ok: a.provider_callback_ok,
          error_message: a.error_message,
        })),
        test_send_id: testRow?.id,
      }),
      {
        status: finalStatus === 'sent' ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (e: any) {
    console.error('managed-email-test error:', e);
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
