import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

function problem(status: number, title: string, detail: string) {
  return new Response(JSON.stringify({ type: 'about:blank', title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });
}

/**
 * Webhook Delivery v2 Engine
 * 
 * POST ?action=dispatch  — Fan-out event to all matching endpoints for a merchant
 * POST ?action=retry     — Retry a specific failed delivery
 * POST ?action=process   — Process pending/failed deliveries (called by cron)
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'dispatch';

    if (action === 'dispatch') {
      // Dispatch event to matching endpoints
      const { merchant_id, event_type, payload } = await req.json();
      if (!merchant_id || !event_type || !payload) {
        return problem(400, 'Bad Request', 'merchant_id, event_type, and payload are required');
      }

      // Find all active endpoints that subscribe to this event
      // F6: do NOT select `secret` — signing is delegated to compute_endpoint_hmac RPC
      const { data: endpoints } = await supabase.from('gateway_webhook_endpoints')
        .select('id, url, events')
        .eq('merchant_id', merchant_id)
        .eq('is_active', true);

      const matchingEndpoints = (endpoints || []).filter(ep =>
        ep.events.includes('*') || ep.events.includes(event_type)
      );

      if (matchingEndpoints.length === 0) {
        return new Response(JSON.stringify({ dispatched: 0, message: 'No matching endpoints' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create delivery records and attempt immediate delivery
      const results = [];
      for (const ep of matchingEndpoints) {
        // F6: sign via DB RPC — endpoint secret never leaves the database.
        // Phase 8: emit timestamped Stripe-style signature (`t=<ts>,v1=<hex>`) over
        // `${ts}.${body}`, plus a parallel legacy raw-body signature header for
        // back-compat. Legacy header is deprecated and will be removed in v5.0.0.
        const ts = Math.floor(Date.now() / 1000);
        const payloadStr = JSON.stringify({ event: event_type, data: payload, timestamp: new Date().toISOString() });
        const signedPayload = `${ts}.${payloadStr}`;
        const [{ data: tsSig, error: tsSigErr }, { data: legacySig }] = await Promise.all([
          supabase.rpc('compute_endpoint_hmac', { p_endpoint_id: ep.id, p_payload: signedPayload }),
          supabase.rpc('compute_endpoint_hmac', { p_endpoint_id: ep.id, p_payload: payloadStr }),
        ]);
        if (tsSigErr || !tsSig) {
          results.push({ endpoint_id: ep.id, delivery_id: null, status: 'failed', error: 'signing_failed' });
          continue;
        }

        let deliveryStatus = 'pending';
        let responseStatus: number | null = null;
        let responseBody: string | null = null;

        try {
          const resp = await fetch(ep.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': `t=${ts},v1=${tsSig}`,
              'X-Webhook-Timestamp': String(ts),
              ...(legacySig ? { 'X-Webhook-Signature-Legacy': legacySig } : {}),
              'X-Webhook-Event': event_type,
              'X-Webhook-ID': crypto.randomUUID(),
            },
            body: payloadStr,
            signal: AbortSignal.timeout(10000),
          });
          responseStatus = resp.status;
          responseBody = await resp.text().catch(() => null);
          deliveryStatus = resp.ok ? 'delivered' : 'failed';
        } catch (fetchErr) {
          deliveryStatus = 'failed';
          responseBody = fetchErr.message;
        }

        // Calculate next retry (exponential backoff: 1m, 5m, 30m, 2h, 8h, 24h, 48h)
        const retryDelays = [60, 300, 1800, 7200, 28800, 86400, 172800];
        const nextRetry = deliveryStatus === 'failed'
          ? new Date(Date.now() + retryDelays[0] * 1000).toISOString()
          : null;

        const { data: delivery } = await supabase.from('gateway_webhook_deliveries_v2').insert({
          endpoint_id: ep.id,
          merchant_id,
          event_type,
          payload: { event: event_type, data: payload },
          response_status: responseStatus,
          response_body: responseBody?.substring(0, 2000),
          status: deliveryStatus,
          delivered_at: deliveryStatus === 'delivered' ? new Date().toISOString() : null,
          next_retry_at: nextRetry,
        }).select('id, status').single();

        results.push({ endpoint_id: ep.id, delivery_id: delivery?.id, status: deliveryStatus });
      }

      return new Response(JSON.stringify({ dispatched: results.length, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'process') {
      // Process pending retries (called by cron)
      const { data: pendingDeliveries } = await supabase.from('gateway_webhook_deliveries_v2')
        .select('id, endpoint_id, merchant_id, event_type, payload, attempt, max_attempts, next_retry_at')
        .eq('status', 'failed')
        .lte('next_retry_at', new Date().toISOString())
        .lt('attempt', 7)
        .order('next_retry_at', { ascending: true })
        .limit(50);

      let processed = 0;
      for (const d of pendingDeliveries || []) {
        const { data: ep } = await supabase.from('gateway_webhook_endpoints')
          .select('url').eq('id', d.endpoint_id).eq('is_active', true).single();
        if (!ep) {
          await supabase.from('gateway_webhook_deliveries_v2').update({ status: 'exhausted' }).eq('id', d.id);
          continue;
        }

        // F6: sign via DB RPC — endpoint secret never leaves the database
        const payloadStr = JSON.stringify(d.payload);
        const { data: signature, error: sigErr } = await supabase.rpc('compute_endpoint_hmac', {
          p_endpoint_id: d.endpoint_id,
          p_payload: payloadStr,
        });
        if (sigErr || !signature) {
          await supabase.from('gateway_webhook_deliveries_v2').update({ status: 'exhausted', response_body: 'signing_failed' }).eq('id', d.id);
          continue;
        }

        let newStatus = 'failed';
        let responseStatus: number | null = null;
        let responseBody: string | null = null;

        try {
          const resp = await fetch(ep.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': signature, 'X-Webhook-Event': d.event_type },
            body: payloadStr,
            signal: AbortSignal.timeout(10000),
          });
          responseStatus = resp.status;
          responseBody = await resp.text().catch(() => null);
          newStatus = resp.ok ? 'delivered' : 'failed';
        } catch (fetchErr) {
          responseBody = fetchErr.message;
        }

        const nextAttempt = d.attempt + 1;
        const retryDelays = [60, 300, 1800, 7200, 28800, 86400, 172800];
        const isExhausted = nextAttempt >= d.max_attempts;

        await supabase.from('gateway_webhook_deliveries_v2').update({
          attempt: nextAttempt,
          status: newStatus === 'delivered' ? 'delivered' : (isExhausted ? 'exhausted' : 'failed'),
          response_status: responseStatus,
          response_body: responseBody?.substring(0, 2000),
          delivered_at: newStatus === 'delivered' ? new Date().toISOString() : null,
          next_retry_at: (!isExhausted && newStatus === 'failed')
            ? new Date(Date.now() + (retryDelays[Math.min(nextAttempt - 1, 6)] || 172800) * 1000).toISOString()
            : null,
        }).eq('id', d.id);

        processed++;
      }

      return new Response(JSON.stringify({ processed, pending: (pendingDeliveries || []).length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return problem(400, 'Bad Request', `Unknown action: ${action}`);
  } catch (err) {
    return problem(500, 'Internal Server Error', err.message);
  }
});
