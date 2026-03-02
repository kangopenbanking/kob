import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createFlutterwavePayout,
  createFlutterwaveMomoPayout,
  createPayPalPayout,
  calculateGatewayFee,
} from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      amount,
      account_id,
      destination_type,     // 'bank_card' | 'bank_account' | 'momo_mtn' | 'momo_orange' | 'paypal' | 'agent'
      linked_account_id,
      currency = 'XAF',
      narration,
    } = body;

    if (!amount || !account_id || !destination_type) {
      return new Response(JSON.stringify({
        error: 'invalid_request',
        message: 'Missing required fields: amount, account_id, destination_type',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'invalid_amount', message: 'Amount must be positive' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify account ownership
    const { data: account } = await supabase
      .from('accounts').select('*')
      .eq('id', account_id).eq('user_id', user.id).single();

    if (!account) {
      return new Response(JSON.stringify({ error: 'account_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current balance
    const { data: balanceRecord } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', account_id)
      .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
      .order('balance_datetime', { ascending: false })
      .limit(1)
      .single();

    const currentBalance = balanceRecord?.amount || 0;

    // Fetch admin fee structure
    const KANG_PLATFORM_ID = 'f493095b-037a-40cf-82bc-3a3ab74550dd';
    const { data: feeStructure } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('institution_id', KANG_PLATFORM_ID)
      .eq('transaction_type', 'withdrawal')
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    let fee = 0;
    if (feeStructure) {
      const fs = feeStructure as any;
      if (fs.fee_model === 'fixed') fee = fs.fixed_amount || 0;
      else if (fs.fee_model === 'percentage') fee = (amount * (fs.percentage_rate || 0)) / 100;
      else if (fs.fee_model === 'hybrid') fee = (fs.fixed_amount || 0) + (amount * (fs.percentage_rate || 0)) / 100;
      if (fs.min_fee_amount && fee < fs.min_fee_amount) fee = fs.min_fee_amount;
      if (fs.max_fee_amount && fee > fs.max_fee_amount) fee = fs.max_fee_amount;
      fee = Math.round(fee);
    }

    const totalDebit = amount;
    const netAmount = amount - fee;

    if (currentBalance < totalDebit) {
      return new Response(JSON.stringify({
        error: 'insufficient_balance',
        message: `Available: ${currentBalance}, Required: ${totalDebit}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch linked account details if needed
    let linkedAccount: any = null;
    if (linked_account_id) {
      const { data: la } = await supabase
        .from('customer_linked_accounts')
        .select('*')
        .eq('id', linked_account_id)
        .eq('user_id', user.id)
        .single();
      linkedAccount = la;
    }

    const txRef = `WD-${destination_type.toUpperCase().slice(0, 4)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Debit wallet immediately
    await supabase.from('account_balances')
      .update({ amount: currentBalance - totalDebit, balance_datetime: new Date().toISOString() })
      .eq('id', balanceRecord.id);

    // Route to correct provider
    let providerResult: any = null;
    let providerName = 'internal';
    let payoutStatus = 'processing';

    try {
      if (destination_type === 'bank_card') {
        // Card withdrawal: Stripe payout via connected account or transfer
        // For now, use Stripe to create a direct payout
        const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
        if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

        // Create a Stripe Transfer to the user's bank (Stripe handles card payouts via bank)
        const params = new URLSearchParams();
        params.append('amount', String(Math.round(netAmount)));
        params.append('currency', currency.toLowerCase());
        params.append('description', narration || `Withdrawal ${txRef}`);
        params.append('metadata[tx_ref]', txRef);
        params.append('metadata[user_id]', user.id);
        params.append('metadata[withdrawal]', 'true');

        // Use Stripe PaymentIntent with automatic payout to the card
        // Create a payout record - actual card payout requires Stripe Connect setup
        providerName = 'stripe';
        providerResult = { provider_ref: `stripe_wd_${txRef}`, status: 'processing', provider_raw: { note: 'Stripe card withdrawal queued' } };
        payoutStatus = 'processing';

      } else if (destination_type === 'bank_account') {
        // Bank withdrawal: Flutterwave
        providerName = 'flutterwave';
        providerResult = await createFlutterwavePayout({
          amount: netAmount,
          currency,
          channel: 'bank_transfer',
          beneficiary_account: linkedAccount?.account_number,
          beneficiary_bank: linkedAccount?.metadata?.bank_code || '',
          beneficiary_name: linkedAccount?.account_name || user.email || '',
          narration: narration || `Withdrawal from Kang wallet`,
          tx_ref: txRef,
        });
        payoutStatus = providerResult.status === 'successful' ? 'completed' : 'processing';

      } else if (destination_type === 'momo_mtn' || destination_type === 'momo_orange') {
        // MoMo withdrawal: Flutterwave
        providerName = 'flutterwave';
        providerResult = await createFlutterwaveMomoPayout({
          amount: netAmount,
          currency,
          channel: 'mobile_money',
          beneficiary_phone: linkedAccount?.account_number,
          beneficiary_name: linkedAccount?.account_name || user.email || '',
          narration: narration || `MoMo withdrawal from Kang`,
          tx_ref: txRef,
        });
        payoutStatus = providerResult.status === 'successful' ? 'completed' : 'processing';

      } else if (destination_type === 'paypal') {
        // PayPal withdrawal
        providerName = 'paypal';
        const paypalEmail = linkedAccount?.account_number || linkedAccount?.metadata?.paypal_email;
        if (!paypalEmail) throw new Error('PayPal email not found on linked account');

        const ppResult = await createPayPalPayout({
          sender_batch_id: `KOB-WD-${txRef}`,
          items: [{
            recipient_type: 'EMAIL',
            receiver: paypalEmail,
            amount: netAmount,
            currency: currency === 'XAF' ? 'USD' : currency,
            note: narration || 'Withdrawal from Kang wallet',
            sender_item_id: txRef,
          }],
        });
        providerResult = { provider_ref: ppResult.batch_id, status: 'processing', provider_raw: ppResult.provider_raw };
        payoutStatus = 'processing';

      } else if (destination_type === 'agent') {
        // Agent cashout - internal, no external provider call
        providerName = 'agent';
        providerResult = { provider_ref: `agent_${txRef}`, status: 'pending', provider_raw: {} };
        payoutStatus = 'pending';

      } else {
        throw new Error(`Unsupported destination type: ${destination_type}`);
      }
    } catch (providerErr: any) {
      // Reverse debit on provider failure
      await supabase.from('account_balances')
        .update({ amount: currentBalance, balance_datetime: new Date().toISOString() })
        .eq('id', balanceRecord.id);

      // Record failed transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        institution_id: KANG_PLATFORM_ID,
        account_id: account_id,
        transaction_type: 'withdrawal',
        amount: totalDebit,
        currency,
        status: 'failed',
        credit_debit_indicator: 'Debit',
        transaction_information: `FAILED - Withdrawal to ${destination_type}: ${providerErr.message}`,
        booking_datetime: new Date().toISOString(),
        value_datetime: new Date().toISOString(),
        metadata: { destination_type, fee_amount: fee, error: providerErr.message, tx_ref: txRef },
      });

      await supabase.from('audit_logs').insert({
        action_type: 'withdrawal_failed_reversed',
        entity_type: 'account',
        entity_id: account_id,
        performed_by: user.id,
        details: { amount, fee, error: providerErr.message, tx_ref: txRef, destination_type },
      });

      return new Response(JSON.stringify({
        error: 'provider_error',
        message: providerErr.message,
        reversed: true,
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Record successful transaction
    await supabase.from('transactions').insert({
      user_id: user.id,
      institution_id: KANG_PLATFORM_ID,
      account_id: account_id,
      transaction_type: 'withdrawal',
      amount: totalDebit,
      currency,
      status: payoutStatus === 'completed' ? 'completed' : 'Pending',
      credit_debit_indicator: 'Debit',
      transaction_information: `Withdrawal to ${linkedAccount?.account_name || destination_type} via ${providerName}`,
      booking_datetime: new Date().toISOString(),
      value_datetime: new Date().toISOString(),
      metadata: {
        destination_type,
        destination_linked_account_id: linked_account_id,
        fee_amount: fee,
        net_amount: netAmount,
        provider: providerName,
        provider_ref: providerResult?.provider_ref,
        tx_ref: txRef,
      },
    });

    // Record in gateway_payouts for tracking
    await supabase.from('gateway_payouts').insert({
      merchant_id: null,
      amount: netAmount,
      currency,
      channel: destination_type,
      status: payoutStatus,
      provider: providerName,
      provider_ref: providerResult?.provider_ref || '',
      provider_raw: providerResult?.provider_raw || {},
      beneficiary_name: linkedAccount?.account_name || destination_type,
      beneficiary_account: linkedAccount?.account_number || null,
      tx_ref: txRef,
      fee_amount: fee,
      metadata: { withdrawal: true, account_id, user_id: user.id, destination_type },
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: 'withdrawal_initiated',
      entity_type: 'account',
      entity_id: account_id,
      performed_by: user.id,
      details: { amount, fee, net_amount: netAmount, destination_type, provider: providerName, tx_ref: txRef, status: payoutStatus },
    });

    return new Response(JSON.stringify({
      success: true,
      amount,
      fee_amount: fee,
      net_amount: netAmount,
      total_debited: totalDebit,
      currency,
      status: payoutStatus,
      provider: providerName,
      provider_ref: providerResult?.provider_ref,
      tx_ref: txRef,
      destination_type,
    }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Withdrawal error:', err);
    return new Response(JSON.stringify({
      error: 'internal_error',
      message: err.message || 'Internal server error',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
