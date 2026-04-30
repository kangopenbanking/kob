// deno-lint-ignore-file
/**
 * Gateway Webhooks Router
 * Consolidates: gateway-webhook-endpoints, gateway-deliver-webhook,
 *               gateway-webhook-deliver-v2, gateway-webhook-stripe,
 *               gateway-webhook-flutterwave, gateway-webhook-paypal
 *
 * Actions: endpoints, deliver, deliver_v2, stripe, flutterwave, paypal
 *
 * NOTE: Inbound webhook receivers (stripe, flutterwave, paypal) are kept as standalone
 * functions because they are called by external providers with specific URLs.
 * This router primarily consolidates the outbound/management functions.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const jsonResp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const url = new URL(req.url);
    let body: any = {};
    if (req.method !== 'GET') {
      try { body = await req.json(); } catch { /* empty body ok */ }
    }

    const action = body.action || url.searchParams.get('action');
    if (!action) return jsonResp({ error: 'missing_action', message: 'action is required: endpoints, deliver, deliver_v2, replay_delivery, endpoint_health' }, 400);

    const functionMap: Record<string, string> = {
      endpoints: 'gateway-webhook-endpoints',
      deliver: 'gateway-deliver-webhook',
      deliver_v2: 'gateway-webhook-deliver-v2',
      // Phase 2 (additive — Standing Order 4 The Surgeon Rule)
      replay_delivery: 'gateway-webhook-replay-delivery',
      endpoint_health: 'gateway-webhook-endpoint-health',
    };

    const targetFunction = functionMap[action];
    if (!targetFunction) {
      return jsonResp({ error: 'invalid_action', message: `Unknown action: ${action}. Valid: ${Object.keys(functionMap).join(', ')}` }, 400);
    }

    const headers: Record<string, string> = {};
    const authHeader = req.headers.get('Authorization');
    if (authHeader) headers.Authorization = authHeader;

    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: Object.keys(body).length > 0 ? body : undefined,
      headers,
    });

    if (error) {
      // Forward downstream auth/client errors with their original status
      const ctx = (error as any).context;
      if (ctx && typeof ctx.status === 'number') {
        const downstream = await ctx.json().catch(() => ({ error: 'downstream_error' }));
        return jsonResp(downstream, ctx.status);
      }
      throw error;
    }
    return jsonResp(data);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-webhooks-router error:`, err);
    return jsonResp({ error: 'internal_error', error_id: errorId }, 500);
  }
});
