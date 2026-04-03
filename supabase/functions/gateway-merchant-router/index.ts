// deno-lint-ignore-file
/**
 * Gateway Merchant Router
 * Consolidates: gateway-merchant-keys, gateway-merchant-kyb, gateway-merchant-kyb-review,
 *               gateway-merchant-lifecycle, gateway-merchant-settlement-accounts,
 *               gateway-merchant-statement, gateway-merchant-webhooks, gateway-get-merchant-balance
 *
 * Actions: keys, kyb, kyb_review, lifecycle, settlement_accounts, statement, webhooks, balance
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

    const url = new URL(req.url);
    let body: any = {};
    if (req.method !== 'GET') {
      try { body = await req.json(); } catch { /* empty body ok */ }
    }

    const action = body.action || url.searchParams.get('action');
    if (!action) return jsonResp({ error: 'missing_action', message: 'action is required: keys, kyb, kyb_review, lifecycle, settlement_accounts, statement, webhooks, balance' }, 400);

    const functionMap: Record<string, string> = {
      keys: 'gateway-merchant-keys',
      kyb: 'gateway-merchant-kyb',
      kyb_review: 'gateway-merchant-kyb-review',
      lifecycle: 'gateway-merchant-lifecycle',
      settlement_accounts: 'gateway-merchant-settlement-accounts',
      statement: 'gateway-merchant-statement',
      webhooks: 'gateway-merchant-webhooks',
      balance: 'gateway-get-merchant-balance',
    };

    const targetFunction = functionMap[action];
    if (!targetFunction) {
      return jsonResp({ error: 'invalid_action', message: `Unknown action: ${action}. Valid: ${Object.keys(functionMap).join(', ')}` }, 400);
    }

    // Forward headers
    const headers: Record<string, string> = { Authorization: authHeader };

    // For functions that use query params, forward the full URL
    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: Object.keys(body).length > 0 ? body : undefined,
      headers,
    });

    if (error) throw error;
    return jsonResp(data);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-merchant-router error:`, err);
    return jsonResp({ error: 'internal_error', error_id: errorId }, 500);
  }
});
