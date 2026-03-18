import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwavePayout, createFlutterwaveMomoPayout, createPayPalPayout } from "../_shared/gateway-adapters.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins, notifyUser } from "../_shared/admin-notify.ts";
import { sendManagedEmail } from "../_shared/send-managed-email.ts";

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
    const isPayPal = settlementAccount.account_type === 'paypal';
    const isBankCard = settlementAccount.account_type === 'card' || settlementAccount.account_type === 'visa_direct';
    const channel = isKobWallet ? 'kob_wallet' : isPayPal ? 'paypal' : isBankCard ? 'card_push' : (settlementAccount.account_type || 'bank_transfer');

    const fmtAmount = new Intl.NumberFormat('fr-CM').format(amount);

    // Create payout request
    const tx_ref = `PAYOUT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const providerForChannel = isKobWallet ? 'kob_internal' : isPayPal ? 'paypal' : isBankCard ? 'stripe' : 'flutterwave';

    const { data: payout, error: payoutError } = await supabase.from('gateway_payouts').insert({
      merchant_id,
      amount,
      currency,
      channel,
      status: 'processing',
      provider: providerForChannel,
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

    // ═══ NOTIFY: Admin alert on all merchant withdrawals ═══
    const isHighValue = amount >= 5000000;
    notifyAdmins(supabase, {
      event_type: 'merchant_withdrawal_initiated',
      entity_type: 'gateway_payout',
      entity_id: payout.id,
      title: isHighValue ? '🔴 High-Value Merchant Withdrawal' : '💸 Merchant Withdrawal Initiated',
      message: `${merchant.business_name} withdrawing ${currency} ${fmtAmount} to ${settlementAccount.account_name || channel} (${channel}). Ref: ${tx_ref}`,
      metadata: { merchant_id, amount, channel, tx_ref, high_value: isHighValue },
    });

    // ═══ KOB Wallet: instant internal transfer ═══
    if (isKobWallet) {
      try {
        const meta = (settlementAccount.metadata as any) || {};
        const consumerAccountId = meta.consumer_account_id;

        if (!consumerAccountId) {
          throw new Error('No consumer account linked');
        }

        const { data: currentBalance } = await supabase
          .from('account_balances')
          .select('id, amount')
          .eq('account_id', consumerAccountId)
          .eq('balance_type', 'ClosingAvailable')
          .eq('credit_debit_indicator', 'Credit')
          .maybeSingle();

        const newAmount = (currentBalance?.amount || 0) + amount;

        if (currentBalance?.id) {
          await supabase.from('account_balances').update({
            amount: newAmount,
            balance_datetime: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', currentBalance.id);
        } else {
          await supabase.from('account_balances').insert({
            account_id: consumerAccountId,
            balance_type: 'ClosingAvailable',
            amount: newAmount,
            currency,
            credit_debit_indicator: 'Credit',
            balance_datetime: new Date().toISOString(),
          });
        }

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

        await supabase.from('gateway_payouts').update({
          status: 'completed',
          metadata: { ...payout.metadata, completed_at: new Date().toISOString(), transfer_type: 'kob_internal', consumer_account_id: consumerAccountId },
        }).eq('id', payout.id);

        await supabase.from('gateway_merchant_wallets').update({
          pending_balance: wallet.pending_balance,
          ledger_balance: wallet.ledger_balance - amount,
          updated_at: new Date().toISOString(),
        }).eq('id', wallet.id);

        // ═══ NOTIFY: Merchant email + in-app on successful KOB transfer ═══
        notifyUser(supabase, {
          user_id: user.id,
          type: 'success',
          title: 'Withdrawal Complete',
          message: `${currency} ${fmtAmount} has been transferred instantly to your Kang wallet.`,
          icon: 'cash_out',
          metadata: { tx_ref, amount, channel: 'kob_wallet' },
        });

        sendManagedEmail(supabase, {
          email_key: 'merchant_withdrawal_completed',
          recipient_user_id: merchant.user_id,
          variables: { merchant_name: merchant.business_name, currency, amount: fmtAmount, destination: 'Kang Consumer Wallet', tx_ref, channel: 'kob_wallet' },
        });

        return new Response(JSON.stringify({ success: true, payout: { ...payout, status: 'completed' }, transfer_type: 'instant' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (internalErr) {
        await supabase.from('gateway_merchant_wallets').update({
          available_balance: wallet.available_balance,
          pending_balance: wallet.pending_balance,
          updated_at: new Date().toISOString(),
        }).eq('id', wallet.id);

        await supabase.from('gateway_payouts').update({
          status: 'failed',
          metadata: { ...payout.metadata, error: String(internalErr) },
        }).eq('id', payout.id);

        // ═══ NOTIFY: Admin + merchant on KOB wallet failure ═══
        notifyAdmins(supabase, {
          event_type: 'merchant_withdrawal_failed',
          entity_type: 'gateway_payout',
          entity_id: payout.id,
          title: '⚠️ Merchant Wallet Transfer Failed',
          message: `${merchant.business_name} withdrawal of ${currency} ${fmtAmount} to Kang wallet failed. Balance restored. Error: ${String(internalErr)}`,
          metadata: { merchant_id, amount, tx_ref, error: String(internalErr) },
        });

        notifyUser(supabase, {
          user_id: user.id,
          type: 'warning',
          title: 'Withdrawal Failed',
          message: `Your ${currency} ${fmtAmount} withdrawal could not be completed. Balance restored.`,
          icon: 'cash_out',
        });

        sendManagedEmail(supabase, {
          email_key: 'merchant_withdrawal_failed',
          recipient_user_id: merchant.user_id,
          variables: { merchant_name: merchant.business_name, currency, amount: fmtAmount, destination: 'Kang Consumer Wallet', tx_ref, error: String(internalErr) },
        });

        const errorId = crypto.randomUUID().slice(0, 8);
        console.error(`[${errorId}] kob_wallet transfer error:`, internalErr);
        return new Response(JSON.stringify({ error: 'internal_transfer_failed', error_id: errorId }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ═══ AUTOMATED EXTERNAL PAYOUTS (bank, MoMo, PayPal, Card) ═══
    const beneficiaryName = settlementAccount.account_name || settlementAccount.account_holder_name || '';
    let providerResult: any = null;
    let finalStatus = 'processing';

    try {
      if (isPayPal) {
        const paypalEmail = settlementAccount.account_number || (settlementAccount.metadata as any)?.paypal_email;
        if (!paypalEmail) throw new Error('PayPal email not found on settlement account');

        const ppResult = await createPayPalPayout({
          amount,
          currency: currency === 'XAF' ? 'USD' : currency,
          channel: 'paypal',
          beneficiary_account: paypalEmail,
          beneficiary_name: beneficiaryName,
          narration: `Business withdrawal from ${merchant.business_name}`,
          tx_ref: `KOB-BIZ-${tx_ref}`,
        });
        providerResult = ppResult;
        finalStatus = ppResult.status === 'successful' ? 'completed' : 'processing';

      } else if (channel === 'mobile_money' || settlementAccount.account_type === 'momo_mtn' || settlementAccount.account_type === 'momo_orange') {
        providerResult = await createFlutterwaveMomoPayout({
          amount,
          currency,
          channel: 'mobile_money',
          beneficiary_phone: settlementAccount.phone_number || settlementAccount.account_number,
          beneficiary_name: beneficiaryName,
          narration: `Business withdrawal from ${merchant.business_name}`,
          tx_ref,
        });
        finalStatus = providerResult.status === 'successful' ? 'completed' : 'processing';

      } else {
        // Default: bank transfer via Flutterwave
        providerResult = await createFlutterwavePayout({
          amount,
          currency,
          channel: 'bank_transfer',
          beneficiary_account: settlementAccount.account_number,
          beneficiary_bank: settlementAccount.bank_code,
          beneficiary_name: beneficiaryName,
          narration: `Business withdrawal from ${merchant.business_name}`,
          tx_ref,
        });
        finalStatus = providerResult.status === 'successful' ? 'completed' : 'processing';
      }

      // Update payout with provider result
      await supabase.from('gateway_payouts').update({
        status: finalStatus,
        provider_ref: providerResult?.provider_ref || '',
        provider_raw: providerResult?.provider_raw || {},
      }).eq('id', payout.id);

      // If completed immediately, settle wallet
      if (finalStatus === 'completed') {
        await supabase.from('gateway_merchant_wallets').update({
          pending_balance: wallet.pending_balance,
          ledger_balance: wallet.ledger_balance - amount,
          updated_at: new Date().toISOString(),
        }).eq('id', wallet.id);
      }

    } catch (providerErr: any) {
      // Provider failed — rollback wallet, mark payout failed
      await supabase.from('gateway_merchant_wallets').update({
        available_balance: wallet.available_balance,
        pending_balance: wallet.pending_balance,
        updated_at: new Date().toISOString(),
      }).eq('id', wallet.id);

      await supabase.from('gateway_payouts').update({
        status: 'failed',
        failure_reason: providerErr.message,
      }).eq('id', payout.id);

      finalStatus = 'failed';

      // ═══ NOTIFY: Admin + merchant on provider failure ═══
      notifyAdmins(supabase, {
        event_type: 'merchant_withdrawal_failed',
        entity_type: 'gateway_payout',
        entity_id: payout.id,
        title: '⚠️ Merchant Withdrawal Failed',
        message: `${merchant.business_name} withdrawal of ${currency} ${fmtAmount} to ${beneficiaryName} (${channel}) failed. Error: ${providerErr.message}. Balance restored.`,
        metadata: { merchant_id, amount, channel, tx_ref, error: providerErr.message },
      });

      notifyUser(supabase, {
        user_id: user.id,
        type: 'warning',
        title: 'Withdrawal Failed',
        message: `Your ${currency} ${fmtAmount} withdrawal to ${beneficiaryName} could not be processed. Balance restored.`,
        icon: 'cash_out',
      });

      sendManagedEmail(supabase, {
        email_key: 'merchant_withdrawal_failed',
        recipient_user_id: merchant.user_id,
        variables: { merchant_name: merchant.business_name, currency, amount: fmtAmount, destination: beneficiaryName, channel, tx_ref, error: providerErr.message },
      });
    }

    // ═══ NOTIFY: Success email to merchant ═══
    if (finalStatus !== 'failed') {
      notifyUser(supabase, {
        user_id: user.id,
        type: finalStatus === 'completed' ? 'success' : 'info',
        title: finalStatus === 'completed' ? 'Withdrawal Complete' : 'Withdrawal Processing',
        message: finalStatus === 'completed'
          ? `${currency} ${fmtAmount} has been sent to ${beneficiaryName}.`
          : `${currency} ${fmtAmount} withdrawal to ${beneficiaryName} is being processed.`,
        icon: 'cash_out',
        metadata: { tx_ref, amount, channel },
      });

      sendManagedEmail(supabase, {
        email_key: finalStatus === 'completed' ? 'merchant_withdrawal_completed' : 'merchant_withdrawal_initiated',
        recipient_user_id: merchant.user_id,
        variables: { merchant_name: merchant.business_name, currency, amount: fmtAmount, destination: beneficiaryName, channel, tx_ref },
      });
    }

    // ═══ EMAIL: Admin alert for high-value merchant withdrawals (>= 5M XAF) ═══
    if (isHighValue) {
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      for (const admin of (admins || [])) {
        sendManagedEmail(supabase, {
          email_key: 'high_value_withdrawal_alert',
          recipient_user_id: admin.user_id,
          variables: { merchant_name: merchant.business_name, currency, amount: fmtAmount, destination: beneficiaryName, channel, tx_ref },
        });
      }
    }

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'merchant_withdrawal_processed',
      entity_type: 'gateway_payout',
      entity_id: payout.id,
      performed_by: user.id,
      details: { merchant_id, amount, channel, status: finalStatus, tx_ref, provider: providerForChannel },
    });

    return new Response(JSON.stringify({ success: true, payout: { ...payout, status: finalStatus }, transfer_type: isKobWallet ? 'instant' : 'automated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] request-payout error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});