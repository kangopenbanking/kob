// deno-lint-ignore-file
/**
 * Gateway Settlement Router
 * Consolidates: gateway-settlement-cron, gateway-settlement-import,
 *               gateway-reconciliation, gateway-reconcile-stuck
 *
 * Actions: cron, import, reconciliation, reconcile_stuck
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
    if (!action) return jsonResp({ error: 'missing_action', message: 'action is required: cron, import, reconciliation, reconcile_stuck' }, 400);

    const functionMap: Record<string, string> = {
      cron: 'gateway-settlement-cron',
      import: 'gateway-settlement-import',
      reconciliation: 'gateway-reconciliation',
      reconcile_stuck: 'gateway-reconcile-stuck',
    };

    const targetFunction = functionMap[action];
    if (!targetFunction) {
      return jsonResp({ error: 'invalid_action', message: `Unknown action: ${action}. Valid: ${Object.keys(functionMap).join(', ')}` }, 400);
    }

    // Forward auth and cron headers
    const headers: Record<string, string> = {};
    const authHeader = req.headers.get('Authorization');
    if (authHeader) headers.Authorization = authHeader;
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret) headers['x-cron-secret'] = cronSecret;

    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: Object.keys(body).length > 0 ? body : undefined,
      headers,
    });

    if (error) throw error;
    return jsonResp(data);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-settlement-router error:`, err);
    return jsonResp({ error: 'internal_error', error_id: errorId }, 500);
  }
});
