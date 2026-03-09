import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Find pending webhook events ready for delivery
    const { data: events, error } = await supabase
      .from('gateway_webhook_events')
      .select('*, gateway_merchants(id, webhook_url)')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .lt('attempts', 7)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ delivered: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let delivered = 0;
    let failed = 0;

    for (const event of events) {
      const merchant = event.gateway_merchants;
      if (!merchant?.webhook_url) {
        await supabase.from('gateway_webhook_events').update({ status: 'failed', last_response_body: 'No webhook URL configured' }).eq('id', event.id);
        failed++;
        continue;
      }

      const payloadStr = JSON.stringify(event.payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      
      // Compute HMAC server-side via DB function — webhook_secret never leaves the database
      let signature = '';
      if (merchant.id) {
        const { data: hmacResult } = await supabase.rpc('compute_webhook_hmac', {
          p_merchant_id: merchant.id,
          p_payload: `${timestamp}.${payloadStr}`,
        });
        signature = hmacResult || '';
      }

      try {
        const res = await fetch(merchant.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-KOB-Signature': signature,
            'X-KOB-Timestamp': timestamp,
            'X-KOB-Event-Type': event.event_type,
            'X-KOB-Event-ID': event.id,
          },
          body: payloadStr,
          signal: AbortSignal.timeout(10000),
        });

        const responseBody = await res.text();

        if (res.ok) {
          await supabase.from('gateway_webhook_events').update({
            status: 'delivered', delivered_at: new Date().toISOString(),
            attempts: event.attempts + 1, last_response_code: res.status, last_response_body: responseBody.substring(0, 500),
          }).eq('id', event.id);
          delivered++;
        } else {
          const nextRetry = new Date(Date.now() + Math.pow(2, event.attempts + 1) * 60000).toISOString();
          const newStatus = event.attempts + 1 >= 7 ? 'failed' : 'pending';
          await supabase.from('gateway_webhook_events').update({
            status: newStatus, attempts: event.attempts + 1, next_retry_at: nextRetry,
            last_response_code: res.status, last_response_body: responseBody.substring(0, 500),
          }).eq('id', event.id);
          failed++;
        }
      } catch (fetchErr) {
        const nextRetry = new Date(Date.now() + Math.pow(2, event.attempts + 1) * 60000).toISOString();
        const newStatus = event.attempts + 1 >= 7 ? 'failed' : 'pending';
        await supabase.from('gateway_webhook_events').update({
          status: newStatus, attempts: event.attempts + 1, next_retry_at: nextRetry,
          last_response_body: fetchErr.message?.substring(0, 500),
        }).eq('id', event.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ delivered, failed, total: events.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] deliver-webhook error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
