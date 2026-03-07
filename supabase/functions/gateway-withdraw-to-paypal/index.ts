import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPayPalPayout, calculateGatewayFee } from "../_shared/gateway-adapters.ts";

import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { amount, account_id, paypal_email, currency = 'USD', narration } = body;

    if (!amount || !account_id || !paypal_email) {
      return new Response(JSON.stringify({
        error: 'invalid_request',
        error_code: 'PAYPAL_WD_001',
        message: 'Missing required fields: amount, account_id, paypal_email',
        error_id: `err_${Date.now()}`,
        timestamp: new Date().toISOString(),
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify account ownership
    const { data: account } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .single();

    if (!account) {
      return new Response(JSON.stringify({ error: 'not_found', message: 'Account not found or not owned by user' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check balance
    const { data: balance } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', account_id)
      .eq('balance_type', 'InterimAvailable')
      .single();

    const { fee } = await calculateGatewayFee(amount, 'paypal', supabase);
    const totalDebit = amount + fee;

    if (!balance || balance.amount < totalDebit) {
      return new Response(JSON.stringify({ error: 'insufficient_funds', message: `Requires ${totalDebit}, available: ${balance?.amount || 0}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Debit account immediately
    await supabase
      .from('account_balances')
      .update({ amount: balance.amount - totalDebit })
      .eq('id', balance.id);

    // Create PayPal payout
    const txRef = `WD-PP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const result = await createPayPalPayout({
      sender_batch_id: `KOB-WD-${txRef}`,
      items: [{
        recipient_type: 'EMAIL',
        receiver: paypal_email,
        amount,
        currency,
        note: narration || 'Withdrawal from Kang account',
        sender_item_id: txRef,
      }],
    });

    // Record payout with withdrawal metadata
    const { data: payout } = await supabase
      .from('gateway_payouts')
      .insert({
        merchant_id: null,
        amount,
        currency,
        channel: 'paypal',
        status: 'processing',
        provider: 'paypal',
        provider_ref: result.batch_id,
        fee_amount: fee,
        tx_ref: txRef,
        beneficiary_name: paypal_email,
        metadata: { withdrawal_account_id: account_id, user_id: user.id, paypal_email },
      })
      .select()
      .single();

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: 'paypal_withdrawal_initiated',
      entity_type: 'gateway_payout',
      entity_id: payout?.id || txRef,
      performed_by: user.id,
      details: { amount, fee, total_debited: totalDebit, account_id, paypal_email, batch_id: result.batch_id },
    });

    return new Response(JSON.stringify({
      id: payout?.id,
      amount,
      fee_amount: fee,
      total_debited: totalDebit,
      currency,
      status: 'processing',
      paypal_email,
      batch_id: result.batch_id,
      tx_ref: txRef,
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('PayPal withdrawal error:', err);
    return new Response(JSON.stringify({
      error: 'internal_error',
      error_code: 'PAYPAL_WD_500',
      message: err.message || 'Internal server error',
      error_id: `err_${Date.now()}`,
      timestamp: new Date().toISOString(),
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
