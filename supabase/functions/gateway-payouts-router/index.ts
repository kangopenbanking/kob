// deno-lint-ignore-file
/**
 * Gateway Payouts Router
 * Consolidates: gateway-create-payout, gateway-request-payout, gateway-cancel-payout,
 *               gateway-retry-payout, gateway-process-withdrawal, gateway-withdraw-to-bank
 *
 * Actions: create, request, cancel, retry, process_withdrawal, withdraw_to_bank
 *
 * NOTE: Each action is complex (100-500 lines). To keep this router maintainable,
 * we forward to the individual edge functions which remain deployed as internal endpoints.
 * The router provides a single entry point for the frontend.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const jsonResp = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResp({ error: 'unauthorized' }, 401);

    const body = await req.json();
    const action = body.action;

    if (!action) return jsonResp({ error: 'missing_action', message: 'action is required: create, request, cancel, retry, process_withdrawal, withdraw_to_bank' }, 400);

    // F27 — Server-side amount/currency validation at the router edge.
    // Downstream functions also validate, but rejecting invalid input here
    // saves a function-to-function invocation and prevents bypass via
    // direct router calls.
    const ACTIONS_REQUIRING_AMOUNT = new Set([
      'create', 'request', 'process_withdrawal', 'withdraw_to_bank', 'retry',
    ]);
    if (ACTIONS_REQUIRING_AMOUNT.has(action)) {
      const amt = body.amount;
      if (typeof amt !== 'number' || !Number.isFinite(amt) || amt <= 0) {
        return jsonResp({ error: 'invalid_amount', message: 'amount must be a positive finite number' }, 400);
      }
      if (amt > 100_000_000) {
        return jsonResp({ error: 'amount_exceeds_cap', message: 'amount exceeds 100,000,000 hard cap' }, 400);
      }
      const currency = body.currency ?? 'XAF';
      if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
        return jsonResp({ error: 'invalid_currency', message: 'currency must be an ISO 4217 three-letter code' }, 400);
      }
    }

    // Map action to the individual function name
    const functionMap: Record<string, string> = {
      create: 'gateway-create-payout',
      request: 'gateway-request-payout',
      cancel: 'gateway-cancel-payout',
      retry: 'gateway-retry-payout',
      process_withdrawal: 'gateway-process-withdrawal',
      withdraw_to_bank: 'gateway-withdraw-to-bank',
    };

    const targetFunction = functionMap[action];
    if (!targetFunction) {
      return jsonResp({ error: 'invalid_action', message: `Unknown action: ${action}. Valid: ${Object.keys(functionMap).join(', ')}` }, 400);
    }

    // Forward to the individual function
    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body,
      headers: {
        Authorization: authHeader,
        ...(req.headers.get('idempotency-key') ? { 'idempotency-key': req.headers.get('idempotency-key')! } : {}),
      },
    });

    if (error) throw error;
    return jsonResp(data);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-payouts-router error:`, err);
    return jsonResp({ error: 'internal_error', error_id: errorId }, 500);
  }
});
