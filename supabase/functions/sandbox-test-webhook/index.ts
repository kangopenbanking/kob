import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { webhook_url, event_type, payload, secret_key } = await req.json();

    if (!webhook_url || !event_type || !payload) {
      return new Response(JSON.stringify({ error: 'webhook_url, event_type, and payload are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Testing webhook: ${webhook_url} with event: ${event_type}`);

    // Send test webhook
    const startTime = Date.now();
    let response, responseBody, error;
    
    try {
      response = await fetch(webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': secret_key || 'test-signature',
          'X-Event-Type': event_type,
        },
        body: JSON.stringify(payload),
      });

      responseBody = await response.text().catch(() => null);
    } catch (fetchError: any) {
      error = fetchError.message;
      console.error('Webhook test error:', fetchError);
    }

    const responseTime = Date.now() - startTime;

    // Get user's sandbox account for logging
    const { data: account } = await supabase
      .from('developer_sandbox_accounts')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Log the test (if account exists and webhook is registered)
    if (account) {
      const { data: webhook } = await supabase
        .from('sandbox_webhooks')
        .select('id')
        .eq('sandbox_account_id', account.id)
        .eq('webhook_url', webhook_url)
        .eq('is_active', true)
        .maybeSingle();

      if (webhook) {
        await supabase
          .from('sandbox_webhook_logs')
          .insert([{
            webhook_id: webhook.id,
            event_type: `test_${event_type}`,
            payload,
            response_status: response?.status || 0,
            response_body: responseBody,
          }]);
      }
    }

    return new Response(JSON.stringify({ 
      success: !error && response?.ok,
      status_code: response?.status || 0,
      response_time_ms: responseTime,
      response_body: responseBody,
      error: error,
      message: error ? 'Webhook test failed' : 'Webhook test completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error testing webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to test webhook. Please try again.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});