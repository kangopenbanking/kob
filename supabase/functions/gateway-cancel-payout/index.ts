import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `${Deno.env.get('SUPABASE_URL')!}/functions/v1/errors/${type}`, title, status, detail }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return rfc7807('method_not_allowed', 'Method Not Allowed', 405, 'Only POST is supported');

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return rfc7807('unauthorized', 'Unauthorized', 401, 'Missing Authorization header');

    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return rfc7807('unauthorized', 'Unauthorized', 401, 'Invalid or expired token');

    const body = await req.json();
    const { payout_id, reason } = body;

    if (!payout_id) return rfc7807('validation_error', 'Validation Error', 400, 'payout_id is required');

    // Fetch payout
    const { data: payout, error: fetchErr } = await supabase
      .from('gateway_payouts')
      .select('*')
      .eq('id', payout_id)
      .single();

    if (fetchErr || !payout) return rfc7807('not_found', 'Payout Not Found', 404, 'Payout does not exist');

    // Authorization: must be the merchant owner OR the consumer who initiated (via metadata)
    const isConsumerPayout = payout.metadata?.withdrawal === true;
    let authorized = false;

    if (isConsumerPayout) {
      authorized = payout.metadata?.user_id === user.id;
    } else if (payout.merchant_id) {
      const { data: merchant } = await supabase
        .from('gateway_merchants').select('user_id')
        .eq('id', payout.merchant_id).single();
      authorized = merchant?.user_id === user.id;
    }

    // Also allow admin
    if (!authorized) {
      const { data: roles } = await supabase
        .from('user_roles').select('role')
        .eq('user_id', user.id);
      authorized = (roles || []).some((r: any) => r.role === 'admin');
    }

    if (!authorized) return rfc7807('forbidden', 'Forbidden', 403, 'You do not have permission to cancel this payout');

    // Only cancellable in pending state (before provider submission has completed)
    const cancellableStatuses = ['pending'];
    if (!cancellableStatuses.includes(payout.status)) {
      return rfc7807('payout_not_cancellable', 'Payout Not Cancellable', 409,
        `Payout is in '${payout.status}' state. Only payouts in 'pending' status can be cancelled.`);
    }

    // Cancel the payout
    await supabase.from('gateway_payouts').update({
      status: 'cancelled',
      failure_reason: reason || 'Cancelled by user',
      updated_at: new Date().toISOString(),
    }).eq('id', payout_id);

    // If consumer withdrawal: reverse the balance debit
    if (isConsumerPayout && payout.metadata?.account_id) {
      const accountId = payout.metadata.account_id;
      const totalDebit = payout.amount + (payout.fee_amount || 0);

      const { data: balanceRecord } = await supabase
        .from('account_balances')
        .select('id, amount')
        .eq('account_id', accountId)
        .eq('balance_type', 'ClosingAvailable')
        .eq('credit_debit_indicator', 'Credit')
        .maybeSingle();

      if (balanceRecord) {
        await supabase.from('account_balances').update({
          amount: balanceRecord.amount + totalDebit,
          balance_datetime: new Date().toISOString(),
        }).eq('id', balanceRecord.id);
      }

      // Update associated transaction to cancelled
      await supabase.from('transactions').update({
        status: 'cancelled',
      }).eq('metadata->>tx_ref', payout.tx_ref)
        .eq('transaction_type', 'withdrawal');
    }

    // If merchant payout: credit back merchant wallet
    if (!isConsumerPayout && payout.merchant_id) {
      await supabase.rpc('update_merchant_wallet', {
        _merchant_id: payout.merchant_id,
        _currency: payout.currency,
        _available_delta: payout.amount,
        _ledger_delta: payout.amount,
      });
    }

    // Audit
    await supabase.from('audit_logs').insert({
      action_type: 'payout_cancelled',
      entity_type: 'gateway_payout',
      entity_id: payout_id,
      performed_by: user.id,
      details: {
        reason,
        amount: payout.amount,
        currency: payout.currency,
        provider: payout.provider,
        tx_ref: payout.tx_ref,
        was_consumer_withdrawal: isConsumerPayout,
        balance_restored: true,
      },
    });

    return json({
      payout_id,
      status: 'cancelled',
      reason: reason || 'Cancelled by user',
      balance_restored: true,
      cancelled_at: new Date().toISOString(),
    });

  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] [gateway-cancel-payout] Error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `An unexpected error occurred. Reference: ${errorId}`);
  }
});
