import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { signPayload } from "../_shared/gateway-adapters.ts";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const url = new URL(req.url);
    const method = req.method;
    const merchantId = url.searchParams.get('merchant_id');
    const webhookId = url.searchParams.get('webhook_id');
    const action = url.searchParams.get('action'); // test, deliveries

    if (!merchantId) return new Response(JSON.stringify({ error: 'merchant_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify ownership
    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchantId).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // List webhooks
    if (method === 'GET' && !webhookId) {
      const { data, error } = await supabase.from('gateway_merchant_webhooks')
        .select('id, merchant_id, url, events, is_active, label, failure_count, created_at, updated_at')
        .eq('merchant_id', merchantId).order('created_at', { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get deliveries for a webhook
    if (method === 'GET' && webhookId && action === 'deliveries') {
      const limit = parseInt(url.searchParams.get('limit') || '25');
      const { data, error } = await supabase.from('gateway_webhook_deliveries')
        .select('*').eq('webhook_id', webhookId).eq('merchant_id', merchantId)
        .order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return new Response(JSON.stringify({ data: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create webhook
    if (method === 'POST' && !action) {
      const body = await req.json();
      const { url: webhookUrl, events, label } = body;
      if (!webhookUrl) return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const secret = crypto.randomUUID() + '-' + crypto.randomUUID();
      const { data, error } = await supabase.from('gateway_merchant_webhooks').insert({
        merchant_id: merchantId, url: webhookUrl, secret,
        events: events || [], label,
      }).select('id, merchant_id, url, events, is_active, label, created_at').single();
      if (error) throw error;

      return new Response(JSON.stringify({ data: { ...data, secret }, warning: 'Store the secret securely. It will not be shown again.' }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test ping
    if (method === 'POST' && action === 'test' && webhookId) {
      const { data: webhook } = await supabase.from('gateway_merchant_webhooks')
        .select('*').eq('id', webhookId).eq('merchant_id', merchantId).single();
      if (!webhook) return new Response(JSON.stringify({ error: 'webhook_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const testPayload = { event: 'test.ping', merchant_id: merchantId, timestamp: new Date().toISOString() };
      const payloadStr = JSON.stringify(testPayload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = await signPayload(`${timestamp}.${payloadStr}`, webhook.secret);

      try {
        const res = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-KOB-Signature': signature, 'X-KOB-Timestamp': timestamp, 'X-KOB-Event-Type': 'test.ping' },
          body: payloadStr,
          signal: AbortSignal.timeout(10000),
        });
        const responseBody = await res.text();
        return new Response(JSON.stringify({ status: res.ok ? 'delivered' : 'failed', response_code: res.status, response_body: responseBody.substring(0, 500) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (fetchErr) {
        return new Response(JSON.stringify({ status: 'failed', error: fetchErr.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Rotate webhook secret
    if (method === 'POST' && action === 'rotate-secret' && webhookId) {
      const { data: webhook } = await supabase.from('gateway_merchant_webhooks')
        .select('id').eq('id', webhookId).eq('merchant_id', merchantId).single();
      if (!webhook) return new Response(JSON.stringify({ error: 'webhook_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const newSecret = crypto.randomUUID() + '-' + crypto.randomUUID();
      const { error } = await supabase.from('gateway_merchant_webhooks')
        .update({ secret: newSecret }).eq('id', webhookId).eq('merchant_id', merchantId);
      if (error) throw error;

      return new Response(JSON.stringify({ data: { id: webhookId, secret: newSecret }, warning: 'Store the new secret securely. It will not be shown again.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update webhook
    if (method === 'PATCH' && webhookId) {
      const body = await req.json();
      const updates: Record<string, unknown> = {};
      if (body.url !== undefined) updates.url = body.url;
      if (body.events !== undefined) updates.events = body.events;
      if (body.is_active !== undefined) updates.is_active = body.is_active;
      if (body.label !== undefined) updates.label = body.label;

      const { data, error } = await supabase.from('gateway_merchant_webhooks')
        .update(updates).eq('id', webhookId).eq('merchant_id', merchantId)
        .select('id, merchant_id, url, events, is_active, label, created_at, updated_at').single();
      if (error) throw error;
      return new Response(JSON.stringify({ data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Delete webhook
    if (method === 'DELETE' && webhookId) {
      await supabase.from('gateway_merchant_webhooks').delete().eq('id', webhookId).eq('merchant_id', merchantId);
      return new Response(JSON.stringify({ status: 'deleted' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] merchant-webhooks error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
