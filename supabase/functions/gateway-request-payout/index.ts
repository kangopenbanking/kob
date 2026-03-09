import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { merchant_id, amount, currency = 'XAF', settlement_account_id, pin } = body;

    if (!merchant_id || !amount || !settlement_account_id || !pin) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify merchant ownership
    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify PIN
    const pinResponse = await supabase.functions.invoke('verify-pin', {
      body: { user_id: user.id, pin },
    });
    if (pinResponse.error || !pinResponse.data?.valid) {
      return new Response(JSON.stringify({ error: 'invalid_pin' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get wallet and check balance
    const { data: wallet } = await supabase
      .from('gateway_merchant_wallets')
      .select('*')
      .eq('merchant_id', merchant_id)
      .eq('currency', currency)
      .single();

    if (!wallet || wallet.available_balance < amount) {
      return new Response(JSON.stringify({ error: 'insufficient_balance' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get settlement account details
    const { data: settlementAccount } = await supabase
      .from('gateway_settlement_accounts')
      .select('*')
      .eq('id', settlement_account_id)
      .eq('merchant_id', merchant_id)
      .eq('is_active', true)
      .single();

    if (!settlementAccount) {
      return new Response(JSON.stringify({ error: 'settlement_account_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create payout request with pending_approval status
    const tx_ref = `PAYOUT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: payout, error: payoutError } = await supabase.from('gateway_payouts').insert({
      merchant_id,
      amount,
      currency,
      channel: settlementAccount.rail_type,
      status: 'pending_approval',
      provider: 'flutterwave',
      beneficiary_name: settlementAccount.account_holder_name,
      beneficiary_account: settlementAccount.account_number,
      beneficiary_bank: settlementAccount.bank_code,
      beneficiary_phone: settlementAccount.mobile_number,
      tx_ref,
      metadata: {
        settlement_account_id,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
      },
    }).select().single();

    if (payoutError) throw payoutError;

    // Atomically move funds from available to pending
    const { error: walletError } = await supabase
      .from('gateway_merchant_wallets')
      .update({
        available_balance: wallet.available_balance - amount,
        pending_balance: wallet.pending_balance + amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (walletError) {
      // Rollback payout creation
      await supabase.from('gateway_payouts').delete().eq('id', payout.id);
      throw walletError;
    }

    return new Response(JSON.stringify({ success: true, payout }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
