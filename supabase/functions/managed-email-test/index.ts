// Admin-only: send a preview of a managed email template to a chosen
// recipient (typically a support agent), record the delivery status, and
// return it so the UI can display sent / failed.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Resolve caller and verify admin role
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
    const { email_key, recipient_email, variables = {}, institution_id } = body || {};

    if (!email_key || !recipient_email) {
      return new Response(
        JSON.stringify({ error: 'email_key and recipient_email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pre-record the test send so it's visible even if delivery fails
    const { data: testRow } = await admin
      .from('managed_email_test_sends')
      .insert({
        email_key,
        recipient_email,
        status: 'queued',
        sent_by: user.id,
        template_data: variables,
      })
      .select()
      .single();

    let status: 'sent' | 'failed' = 'sent';
    let errorMessage: string | null = null;
    let messageId: string | null = null;

    try {
      const { data, error } = await admin.functions.invoke('managed-send-email', {
        body: {
          email_key,
          recipient_email,
          institution_id,
          variables: {
            customer_name: 'Test Recipient',
            agent_name: 'Test Agent',
            department_name: 'Customer Support',
            subject: 'Sample subject for preview',
            customer: 'Test Customer',
            channel: 'website',
            portal_url: `${new URL(req.url).origin.replace('functions.', '')}/admin/support-chat`,
            currency: 'XAF',
            amount: '50,000',
            reference: 'TEST-PREVIEW',
            date: new Date().toLocaleDateString(),
            ...variables,
          },
        },
      });
      if (error) throw error;
      messageId = (data as any)?.message_id || null;
    } catch (e: any) {
      status = 'failed';
      errorMessage = e?.message || String(e);
    }

    if (testRow?.id) {
      await admin
        .from('managed_email_test_sends')
        .update({
          status,
          error_message: errorMessage,
          message_id: messageId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', testRow.id);
    }

    return new Response(
      JSON.stringify({
        success: status === 'sent',
        status,
        error: errorMessage,
        message_id: messageId,
        test_send_id: testRow?.id,
      }),
      {
        status: status === 'sent' ? 200 : 502,
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
