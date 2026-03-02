import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwavePayout, calculateGatewayFee } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { amount, account_id, bank_code, account_number, beneficiary_name, narration, channel = 'bank_transfer' } = body;

    // Validate
    if (!amount || !account_id || !account_number || !beneficiary_name) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'amount, account_id, account_number, beneficiary_name required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'invalid_amount', message: 'Amount must be greater than zero' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify account belongs to user
    const { data: account } = await supabase.from('accounts').select('*').eq('id', account_id).eq('user_id', user.id).eq('is_active', true).single();
    if (!account) {
      return new Response(JSON.stringify({ error: 'account_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check balance
    const { data: balances } = await supabase.from('account_balances')
      .select('amount, credit_debit_indicator')
      .eq('account_id', account_id)
      .order('balance_datetime', { ascending: false })
      .limit(10);

    const availableBalance = (balances || []).reduce((sum: number, b: any) => {
      return b.credit_debit_indicator === 'Credit' ? sum + b.amount : sum - b.amount;
    }, 0);

    // Fee calculation
    const { fee, net } = calculateGatewayFee(amount, channel);
    const totalDebit = amount + fee;

    if (availableBalance < totalDebit) {
      return new Response(JSON.stringify({
        error: 'insufficient_balance',
        message: `Insufficient balance. Available: ${availableBalance}, Required: ${totalDebit} (${amount} + ${fee} fee)`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Idempotency
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      const { data: existing } = await supabase.from('idempotency_keys').select('response_body').eq('idempotency_key', idempotencyKey).maybeSingle();
      if (existing) return new Response(JSON.stringify(existing.response_body), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
    }

    const txRef = `withdraw_${account_id.substring(0, 8)}_${Date.now()}`;

    // Debit user's account immediately (will reverse if payout fails)
    await supabase.from('account_balances').insert({
      account_id, balance_type: 'InterimAvailable',
      amount: totalDebit, currency: account.currency,
      credit_debit_indicator: 'Debit',
      balance_datetime: new Date().toISOString(),
    });

    // Record debit transaction
    await supabase.from('transactions').insert({
      account_id, amount: totalDebit, currency: account.currency,
      credit_debit_indicator: 'Debit', status: 'Pending',
      institution_id: account.institution_id || '00000000-0000-0000-0000-000000000000',
      transaction_type: 'withdrawal',
      booking_datetime: new Date().toISOString(),
      value_datetime: new Date().toISOString(),
      transaction_information: `Withdrawal to bank ${beneficiary_name} - ${txRef}`,
      merchant_details: { transaction_ref: txRef }, user_id: user.id,
    }).then(() => {}).catch(() => {});

    // Initiate Flutterwave payout
    let payoutResult;
    try {
      payoutResult = await createFlutterwavePayout({
        amount, currency: account.currency, channel,
        beneficiary_account: account_number,
        beneficiary_bank: bank_code,
        beneficiary_name,
        narration: narration || `Withdrawal from KOB account`,
        tx_ref: txRef,
      });
    } catch (payoutErr: any) {
      // Reverse debit on provider failure
      await supabase.from('account_balances').insert({
        account_id, balance_type: 'InterimAvailable',
        amount: totalDebit, currency: account.currency,
        credit_debit_indicator: 'Credit',
        balance_datetime: new Date().toISOString(),
      });

      await supabase.from('audit_logs').insert({
        action_type: 'gateway_withdraw_failed_reversed', entity_type: 'account', entity_id: account_id,
        performed_by: user.id, details: { amount, error: payoutErr.message, tx_ref: txRef },
      }).then(() => {}).catch(() => {});

      return new Response(JSON.stringify({ error: 'payout_failed', message: payoutErr.message }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Record in gateway_payouts for webhook tracking
    const { data: payout } = await supabase.from('gateway_payouts').insert({
      merchant_id: null,
      amount, currency: account.currency, channel,
      status: payoutResult.status === 'successful' ? 'completed' : 'processing',
      provider: 'flutterwave',
      provider_ref: payoutResult.provider_ref,
      provider_raw: payoutResult.provider_raw,
      beneficiary_name, beneficiary_phone: null,
      beneficiary_account: account_number,
      beneficiary_bank: bank_code,
      tx_ref: txRef, fee_amount: fee,
      metadata: { withdraw_to_bank: true, account_id, user_id: user.id },
    }).select().single();

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_withdraw_initiated', entity_type: 'account', entity_id: account_id,
      performed_by: user.id, details: { amount, fee, bank_code, account_number, tx_ref: txRef, provider_status: payoutResult.status },
    }).then(() => {}).catch(() => {});

    const response = {
      id: payout?.id,
      account_id,
      amount,
      fee_amount: fee,
      total_debited: totalDebit,
      currency: account.currency,
      channel,
      status: payoutResult.status === 'successful' ? 'completed' : 'processing',
      beneficiary_name,
      beneficiary_account: account_number,
      beneficiary_bank: bank_code,
      tx_ref: txRef,
      created_at: payout?.created_at,
    };

    if (idempotencyKey) {
      await supabase.from('idempotency_keys').insert({
        idempotency_key: idempotencyKey, response_body: response,
        response_status: 200, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).then(() => {}).catch(() => {});
    }

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
