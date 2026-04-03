// deno-lint-ignore-file
/**
 * Gateway Funding Router
 * Consolidates: gateway-fund-account, gateway-create-funding-intent,
 *               gateway-confirm-funding, gateway-reconcile-funding
 *
 * Actions: fund_account, create_intent, confirm, reconcile
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const jsonResp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResp({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const action = body.action;

    if (!action) return jsonResp({ error: 'missing_action', message: 'action is required: fund_account, create_intent, confirm, reconcile' }, 400);

    const functionMap: Record<string, string> = {
      fund_account: 'gateway-fund-account',
      create_intent: 'gateway-create-funding-intent',
      confirm: 'gateway-confirm-funding',
      reconcile: 'gateway-reconcile-funding',
    };

    const targetFunction = functionMap[action];
    if (!targetFunction) {
      return jsonResp({ error: 'invalid_action', message: `Unknown action: ${action}. Valid: ${Object.keys(functionMap).join(', ')}` }, 400);
    }

    const headers: Record<string, string> = { Authorization: authHeader };
    const idemKey = req.headers.get('idempotency-key');
    if (idemKey) headers['idempotency-key'] = idemKey;
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret) headers['x-cron-secret'] = cronSecret;

    const { data, error } = await supabase.functions.invoke(targetFunction, { body, headers });
    if (error) throw error;
    return jsonResp(data);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-funding-router error:`, err);
    return jsonResp({ error: 'internal_error', error_id: errorId }, 500);
  }
});
