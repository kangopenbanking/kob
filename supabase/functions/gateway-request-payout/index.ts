import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
      .from('gateway_merchant_settlement_accounts')
      .select('*')
      .eq('id', settlement_account_id)
      .eq('merchant_id', merchant_id)
      .eq('is_active', true)
      .single();

    if (!settlementAccount) {
      return new Response(JSON.stringify({ error: 'settlement_account_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isKobWallet = settlementAccount.account_type === 'kob_wallet';
    const channel = isKobWallet ? 'kob_wallet' : (settlementAccount.account_type || 'bank_transfer');

    // Create payout request
    const tx_ref = `PAYOUT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: payout, error: payoutError } = await supabase.from('gateway_payouts').insert({
      merchant_id,
      amount,
      currency,
      channel,
      status: isKobWallet ? 'processing' : 'pending_approval',
      provider: isKobWallet ? 'kob_internal' : 'flutterwave',
      beneficiary_name: settlementAccount.account_name || settlementAccount.account_holder_name,
      beneficiary_account: settlementAccount.account_number,
      beneficiary_bank: settlementAccount.bank_code,
      beneficiary_phone: settlementAccount.phone_number,
      tx_ref,
      metadata: {
        settlement_account_id,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
        account_type: settlementAccount.account_type,
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
      await supabase.from('gateway_payouts').delete().eq('id', payout.id);
      throw walletError;
    }

    // KOB Wallet: instant internal transfer
    if (isKobWallet) {
      try {
        const meta = (settlementAccount.metadata as any) || {};
        const consumerAccountId = meta.consumer_account_id;

        if (!consumerAccountId) {
          throw new Error('No consumer account linked');
        }

        // Get current consumer balance
        const { data: currentBalance } = await supabase
          .from('account_balances')
          .select('id, amount')
          .eq('account_id', consumerAccountId)
          .eq('balance_type', 'ClosingAvailable')
          .eq('credit_debit_indicator', 'Credit')
          .maybeSingle();

        const newAmount = (currentBalance?.amount || 0) + amount;

        if (currentBalance?.id) {
          // Update existing balance
          await supabase
            .from('account_balances')
            .update({
              amount: newAmount,
              balance_datetime: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentBalance.id);
        } else {
          // Insert new balance record
          await supabase.from('account_balances').insert({
            account_id: consumerAccountId,
            balance_type: 'ClosingAvailable',
            amount: newAmount,
            currency,
            credit_debit_indicator: 'Credit',
            balance_datetime: new Date().toISOString(),
          });
        }

        // Insert consumer transaction (triggers notify_new_transaction)
        await supabase.from('transactions').insert({
          account_id: consumerAccountId,
          amount,
          currency,
          credit_debit_indicator: 'Credit',
          status: 'Booked',
          transaction_type: 'Transfer',
          transaction_information: `Withdrawal from ${merchant.business_name} business wallet`,
          booking_date_time: new Date().toISOString(),
          value_date_time: new Date().toISOString(),
          merchant_name: merchant.business_name,
          balance_after_transaction: newAmount,
        });

        // Mark payout completed, move from pending to settled
        await supabase.from('gateway_payouts').update({
          status: 'completed',
          metadata: {
            ...payout.metadata,
            completed_at: new Date().toISOString(),
            transfer_type: 'kob_internal',
            consumer_account_id: consumerAccountId,
          },
        }).eq('id', payout.id);

        // Settle wallet: reduce pending
        await supabase
          .from('gateway_merchant_wallets')
          .update({
            pending_balance: wallet.pending_balance + amount - amount, // net zero after debit
            ledger_balance: wallet.ledger_balance - amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id);

        return new Response(JSON.stringify({ success: true, payout: { ...payout, status: 'completed' }, transfer_type: 'instant' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (internalErr) {
        // Rollback: restore wallet, fail payout
        await supabase.from('gateway_merchant_wallets').update({
          available_balance: wallet.available_balance,
          pending_balance: wallet.pending_balance,
          updated_at: new Date().toISOString(),
        }).eq('id', wallet.id);

        await supabase.from('gateway_payouts').update({
          status: 'failed',
          metadata: { ...payout.metadata, error: String(internalErr) },
        }).eq('id', payout.id);

        const errorId = crypto.randomUUID().slice(0, 8);
        console.error(`[${errorId}] kob_wallet transfer error:`, internalErr);
        return new Response(JSON.stringify({ error: 'internal_transfer_failed', error_id: errorId }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, payout }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] request-payout error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
