import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

import { corsHeaders } from "../_shared/cors.ts";

async function sendWebhook(webhookUrl: string, payload: any, secretKey: string) {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': secretKey,
      },
      body: JSON.stringify(payload),
    });

    return {
      status: response.status,
      body: await response.text().catch(() => null),
    };
  } catch (error) {
    return {
      status: 0,
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { api_key_id, event_type, payload } = await req.json();

    if (!api_key_id || !event_type || !payload) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get API key and sandbox account
    const { data: keyData, error: keyError } = await supabase
      .from('sandbox_api_keys')
      .select('sandbox_account_id')
      .eq('id', api_key_id)
      .single();

    if (keyError || !keyData) {
      return new Response(JSON.stringify({ error: 'API key not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get active webhooks for this account
    const { data: webhooks, error: webhooksError } = await supabase
      .from('sandbox_webhooks')
      .select('*')
      .eq('sandbox_account_id', keyData.sandbox_account_id)
      .eq('is_active', true)
      .contains('event_types', [event_type]);

    if (webhooksError) {
      throw webhooksError;
    }

    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ message: 'No active webhooks for this event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Send to all matching webhooks
    const results = await Promise.all(
      webhooks.map(async (webhook) => {
        const result = await sendWebhook(webhook.webhook_url, payload, webhook.secret_key);

        // Log the delivery
        await supabase
          .from('sandbox_webhook_logs')
          .insert([{
            webhook_id: webhook.id,
            event_type,
            payload,
            response_status: result.status,
            response_body: result.body,
          }]);

        // Update last triggered time
        await supabase
          .from('sandbox_webhooks')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', webhook.id);

        return result;
      })
    );

    return new Response(JSON.stringify({ 
      message: 'Webhooks triggered',
      results: results.map(r => ({ status: r.status }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error triggering webhooks:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to trigger webhooks. Please try again.'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});