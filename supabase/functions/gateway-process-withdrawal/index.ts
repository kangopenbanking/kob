import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createFlutterwavePayout,
  createFlutterwaveMomoPayout,
  createPayPalPayout,
  calculateGatewayFee,
} from "../_shared/gateway-adapters.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins, notifyUser } from "../_shared/admin-notify.ts";
import { sendManagedEmail } from "../_shared/send-managed-email.ts";
import { selectBankPayoutRail, describeRailDecision } from "../_shared/bank-payout-router.ts";
import { recordTransactionFee } from "../_shared/record-transaction-fee.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth — supports user JWT OR internal cron call (service-role + x-internal-secret + on_behalf_of)
    const authHeader = req.headers.get('Authorization');
    const internalSecret = req.headers.get('x-internal-secret');
    const onBehalfOf = req.headers.get('x-on-behalf-of');
    const expectedInternal = Deno.env.get('INTERNAL_FUNCTION_SECRET');

    let user: { id: string; email?: string } | null = null;

    if (internalSecret && expectedInternal && internalSecret === expectedInternal && onBehalfOf) {
      // F43 — internal cron-driven withdrawal on behalf of a user
      const { data: profile } = await supabase
        .from('profiles').select('id, email').eq('id', onBehalfOf).maybeSingle();
      if (profile) user = { id: profile.id, email: profile.email || undefined };
    } else {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      user = { id: authUser.id, email: authUser.email };
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const {
      amount,
      account_id,
      destination_type,     // 'bank_card' | 'bank_account' | 'momo_mtn' | 'momo_orange' | 'paypal'
      linked_account_id,
      currency = 'XAF',
      narration,
      preferred_rail,       // 'auto' | 'kob_open_banking' | 'flutterwave'  (Phase 25)
    } = body;

    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;

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

    // Idempotency check — prevent double-debit on network retries
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from('idempotency_keys')
        .select('response_body')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify(existing.response_body), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' },
        });
      }
    }

    // Verify account ownership (must be active)
    const { data: account } = await supabase
      .from('accounts').select('*')
      .eq('id', account_id).eq('user_id', user.id).eq('is_active', true).single();

    if (!account) {
      return new Response(JSON.stringify({ error: 'account_not_found', message: 'Account not found or inactive' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current balance
    const { data: balanceRecord } = await supabase
      .from('account_balances')
      .select('*')
      .eq('account_id', account_id)
      .eq('credit_debit_indicator', 'Credit')
      .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
      .order('balance_datetime', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!balanceRecord) {
      return new Response(JSON.stringify({
        error: 'no_balance_record',
        message: 'No balance record found for this account. Please fund your wallet first.',
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const currentBalance = balanceRecord.amount || 0;

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

    const totalDebit = amount + fee;
    const netAmount = amount;

    if (currentBalance < totalDebit) {
      return new Response(JSON.stringify({
        error: 'insufficient_balance',
        message: `Available: ${currentBalance}, Required: ${totalDebit}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── Compliance pre-screening ───
    try {
      const complianceResp = await supabase.functions.invoke('gateway-compliance-screen', {
        body: { user_id: user.id, amount, currency, destination_type },
        headers: authHeader ? { Authorization: authHeader } : {},
      });
      const complianceResult = complianceResp.data;
      if (complianceResult?.decision === 'denied') {
        return new Response(JSON.stringify({
          error: 'compliance_denied',
          message: complianceResult.reason || 'Withdrawal blocked by compliance screening',
          flags: complianceResult.flags,
        }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (complianceResult?.decision === 'review') {
        console.log(`[Withdrawal] Compliance flagged for review: user=${user.id} amount=${amount}`);
        // Proceed but flag in metadata below
      }
    } catch (compErr) {
      console.error('[Withdrawal] Compliance screening error (non-blocking):', compErr);
    }

    // ─── Velocity limits (daily/monthly caps) ───
    const { sumUsageForPeriod } = await import("../_shared/limits-enforcement.ts");
    const DAILY_WITHDRAWAL_LIMIT = 500000;
    const MONTHLY_WITHDRAWAL_LIMIT = 5000000;

    const dailyUsage = await sumUsageForPeriod({
      supabase,
      table: 'gateway_payouts',
      amountColumn: 'amount',
      dateColumn: 'created_at',
      filters: { 'metadata->>user_id': user.id },
      statuses: ['processing', 'completed', 'pending'],
      period: 'day',
    });

    if (dailyUsage + amount > DAILY_WITHDRAWAL_LIMIT) {
      const remaining = Math.max(DAILY_WITHDRAWAL_LIMIT - dailyUsage, 0);
      return new Response(JSON.stringify({
        error: 'daily_limit_exceeded',
        message: `Daily withdrawal limit of XAF ${DAILY_WITHDRAWAL_LIMIT.toLocaleString()} reached. Remaining: XAF ${remaining.toLocaleString()}`,
        daily_used: dailyUsage,
        daily_limit: DAILY_WITHDRAWAL_LIMIT,
        remaining,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const monthlyUsage = await sumUsageForPeriod({
      supabase,
      table: 'gateway_payouts',
      amountColumn: 'amount',
      dateColumn: 'created_at',
      filters: { 'metadata->>user_id': user.id },
      statuses: ['processing', 'completed', 'pending'],
      period: 'month',
    });

    if (monthlyUsage + amount > MONTHLY_WITHDRAWAL_LIMIT) {
      const remaining = Math.max(MONTHLY_WITHDRAWAL_LIMIT - monthlyUsage, 0);
      return new Response(JSON.stringify({
        error: 'monthly_limit_exceeded',
        message: `Monthly withdrawal limit of XAF ${MONTHLY_WITHDRAWAL_LIMIT.toLocaleString()} reached. Remaining: XAF ${remaining.toLocaleString()}`,
        monthly_used: monthlyUsage,
        monthly_limit: MONTHLY_WITHDRAWAL_LIMIT,
        remaining,
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
    const fmtAmount = new Intl.NumberFormat('fr-CM').format(amount);
    const fmtNet = new Intl.NumberFormat('fr-CM').format(netAmount);
    const destName = linkedAccount?.account_name || destination_type;

    // Debit wallet atomically (row-level lock prevents race conditions)
    const { data: debitResult, error: debitErr } = await supabase.rpc('atomic_consumer_withdrawal_debit', {
      _balance_id: balanceRecord.id,
      _debit_amount: totalDebit,
    });

    if (debitErr || !debitResult?.success) {
      const errMsg = debitResult?.error || debitErr?.message || 'Debit failed';
      return new Response(JSON.stringify({
        error: errMsg === 'insufficient_balance' ? 'insufficient_balance' : 'debit_failed',
        message: errMsg === 'insufficient_balance' 
          ? `Available: ${debitResult?.available}, Required: ${totalDebit}`
          : errMsg,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Route to correct provider
    let providerResult: any = null;
    let providerName = 'internal';
    let payoutStatus = 'processing';

    try {
      if (destination_type === 'bank_card') {
        const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
        if (!STRIPE_SECRET) throw new Error('STRIPE_SECRET_KEY not configured');

        providerName = 'stripe';
        let paymentIntentId = linkedAccount?.metadata?.stripe_payment_intent_id;

        if (!paymentIntentId) {
          const { data: recentFunding } = await supabase
            .from('funding_intents')
            .select('provider_reference')
            .eq('user_id', user.id)
            .eq('provider', 'stripe')
            .eq('status', 'succeeded')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          paymentIntentId = recentFunding?.provider_reference;
        }

        if (!paymentIntentId) {
          throw new Error('No prior card deposit found. Card withdrawals require a previous Stripe card payment to refund against. Please use a different withdrawal method.');
        }

        const { createStripeCardPayout: stripePayout } = await import("../_shared/gateway-adapters.ts");
        providerResult = await stripePayout(paymentIntentId, netAmount, currency);
        payoutStatus = providerResult.status === 'successful' ? 'completed' : 'processing';

      } else if (destination_type === 'bank_account') {
        // ─── Phase 25 — Try KOB Open Banking rail first, fall back to Flutterwave ───
        const railSelection = await selectBankPayoutRail({
          supabase,
          bank_code: linkedAccount?.metadata?.bank_code,
          swift_bic: linkedAccount?.metadata?.swift_bic,
          environment: (Deno.env.get('KOB_RAIL_ENV') as 'sandbox' | 'live') || 'sandbox',
          preferred_rail: (preferred_rail as any) || 'auto',
          source_account: 'KANG-PLATFORM',
        });

        console.log(`[withdrawal] rail decision`, describeRailDecision(railSelection));

        if (railSelection.rail === 'kob_open_banking' && railSelection.execute) {
          try {
            const kobResult = await railSelection.execute({
              to_account: linkedAccount?.account_number || '',
              amount: netAmount,
              currency,
              reference: txRef,
              description: narration || `KOB Open Banking payout`,
              beneficiary_name: linkedAccount?.account_name || user.email || '',
              beneficiary_bank_code: linkedAccount?.metadata?.bank_code,
            });

            if (kobResult.success) {
              providerName = `kob:${railSelection.adapter_type}`;
              providerResult = {
                provider_ref: kobResult.bank_tx_id || txRef,
                status: kobResult.status === 'executed' ? 'successful' : 'pending',
                provider_raw: { ...kobResult, rail: describeRailDecision(railSelection) },
              };
              payoutStatus = kobResult.status === 'executed' ? 'completed' : 'processing';
            } else {
              throw new Error(kobResult.error || 'KOB connector returned failure');
            }
          } catch (kobErr: any) {
            console.warn(`[withdrawal] KOB rail failed, falling back to Flutterwave: ${kobErr.message}`);
            providerName = 'flutterwave';
            providerResult = await createFlutterwavePayout({
              amount: netAmount,
              currency,
              channel: 'bank_transfer',
              beneficiary_account: linkedAccount?.account_number,
              beneficiary_bank: linkedAccount?.metadata?.bank_code || '',
              beneficiary_name: linkedAccount?.account_name || user.email || '',
              narration: narration || `Automated withdrawal from Kang wallet (KOB fallback)`,
              tx_ref: txRef,
            });
            providerResult.provider_raw = {
              ...providerResult.provider_raw,
              kob_attempt_failed: kobErr.message,
              rail_decision: describeRailDecision(railSelection),
            };
            payoutStatus = providerResult.status === 'successful' ? 'completed' : 'processing';
          }
        } else {
          providerName = 'flutterwave';
          providerResult = await createFlutterwavePayout({
            amount: netAmount,
            currency,
            channel: 'bank_transfer',
            beneficiary_account: linkedAccount?.account_number,
            beneficiary_bank: linkedAccount?.metadata?.bank_code || '',
            beneficiary_name: linkedAccount?.account_name || user.email || '',
            narration: narration || `Automated withdrawal from Kang wallet`,
            tx_ref: txRef,
          });
          providerResult.provider_raw = {
            ...providerResult.provider_raw,
            rail_decision: describeRailDecision(railSelection),
          };
          payoutStatus = providerResult.status === 'successful' ? 'completed' : 'processing';
        }

      } else if (destination_type === 'momo_mtn' || destination_type === 'momo_orange') {
        providerName = 'flutterwave';
        providerResult = await createFlutterwaveMomoPayout({
          amount: netAmount,
          currency,
          channel: 'mobile_money',
          beneficiary_phone: linkedAccount?.account_number,
          beneficiary_name: linkedAccount?.account_name || user.email || '',
          narration: narration || `Automated MoMo withdrawal from Kang`,
          tx_ref: txRef,
        });
        payoutStatus = providerResult.status === 'successful' ? 'completed' : 'processing';

      } else if (destination_type === 'paypal') {
        providerName = 'paypal';
        const paypalEmail = linkedAccount?.account_number || linkedAccount?.metadata?.paypal_email;
        if (!paypalEmail) throw new Error('PayPal email not found on linked account');

        const ppResult = await createPayPalPayout({
          amount: netAmount,
          currency: currency === 'XAF' ? 'USD' : currency,
          channel: 'paypal',
          beneficiary_account: paypalEmail,
          beneficiary_name: linkedAccount?.account_name || user.email || 'Customer',
          narration: narration || 'Automated withdrawal from Kang wallet',
          tx_ref: `KOB-WD-${txRef}`,
        });
        providerResult = { provider_ref: ppResult.provider_ref, status: ppResult.status, provider_raw: ppResult.provider_raw };
        payoutStatus = ppResult.status === 'successful' ? 'completed' : 'processing';

      } else {
        throw new Error(`Unsupported destination type: ${destination_type}`);
      }
    } catch (providerErr: any) {
      // F41 — Atomic reversal (adds back the debit instead of overwriting)
      await supabase.rpc('atomic_consumer_withdrawal_reverse', {
        _balance_id: balanceRecord.id,
        _reverse_amount: totalDebit,
      });

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

      // ═══ NOTIFY: Admin alert on failed withdrawal ═══
      notifyAdmins(supabase, {
        event_type: 'withdrawal_failed',
        entity_type: 'account',
        entity_id: account_id,
        title: '⚠️ Consumer Withdrawal Failed',
        message: `Withdrawal of ${currency} ${fmtAmount} to ${destName} (${destination_type}) failed and was auto-reversed. Error: ${providerErr.message}`,
        metadata: { user_id: user.id, amount, fee, destination_type, tx_ref: txRef, error: providerErr.message },
      });

      // ═══ NOTIFY: User in-app alert on failure ═══
      notifyUser(supabase, {
        user_id: user.id,
        type: 'warning',
        title: 'Withdrawal Failed',
        message: `Your ${currency} ${fmtAmount} withdrawal to ${destName} could not be processed. Your balance has been restored.`,
        icon: 'cash_out',
        metadata: { tx_ref: txRef, amount, destination_type },
      });

      // ═══ EMAIL: User failure notification ═══
      sendManagedEmail(supabase, {
        email_key: 'consumer_withdrawal_failed',
        recipient_user_id: user.id,
        variables: { currency, amount: fmtAmount, destination: destName, destination_type, error: providerErr.message, tx_ref: txRef },
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
      transaction_information: `Withdrawal to ${destName} via ${providerName}`,
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
      beneficiary_name: destName,
      beneficiary_account: linkedAccount?.account_number || null,
      tx_ref: txRef,
      fee_amount: fee,
      metadata: { withdrawal: true, account_id, user_id: user.id, destination_type },
    });

    // F52 — Record fee for the admin Fees tab / billing engine
    if (fee > 0) {
      await recordTransactionFee({
        supabase,
        institutionId: KANG_PLATFORM_ID,
        transactionType: 'withdrawal',
        transactionRef: txRef,
        transactionAmount: amount,
        transactionCurrency: currency,
        feeModel: (feeStructure as any)?.fee_model || 'hybrid',
        feeStructureId: (feeStructure as any)?.id || null,
        calculatedFee: fee,
        finalFee: fee,
        metadata: { destination_type, provider: providerName, user_id: user.id },
      });
    }

    // F54 — Trigger bank ledger reconciliation poll when KOB rail was used so
    // the user's bank-side balance is refreshed in our system as soon as the
    // upstream bank confirms posting (best-effort, non-blocking).
    if (providerName.startsWith('kob:')) {
      const railMeta: any = providerResult?.provider_raw?.rail || providerResult?.provider_raw?.rail_decision;
      if (railMeta?.bank_id) {
        supabase.functions.invoke('bank-data-poller', {
          body: { bank_id: railMeta.bank_id, reason: 'post_withdrawal_refresh', tx_ref: txRef },
        }).then(() => {}).catch(() => {});
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action_type: 'withdrawal_initiated',
      entity_type: 'account',
      entity_id: account_id,
      performed_by: user.id,
      details: { amount, fee, net_amount: netAmount, destination_type, provider: providerName, tx_ref: txRef, status: payoutStatus },
    });

    // ═══ NOTIFY: Admin alert on all withdrawals ═══
    const isHighValue = amount >= 1000000;
    notifyAdmins(supabase, {
      event_type: 'withdrawal_initiated',
      entity_type: 'account',
      entity_id: account_id,
      title: isHighValue ? '🔴 High-Value Consumer Withdrawal' : '💸 Consumer Withdrawal Initiated',
      message: `${currency} ${fmtAmount} withdrawal to ${destName} (${destination_type}) via ${providerName}. Status: ${payoutStatus}. Ref: ${txRef}`,
      metadata: { user_id: user.id, amount, fee, net_amount: netAmount, destination_type, provider: providerName, tx_ref: txRef, status: payoutStatus, high_value: isHighValue },
    });

    // ═══ EMAIL: Admin alert for high-value (>= 1M XAF) ═══
    if (isHighValue) {
      sendManagedEmail(supabase, {
        email_key: 'high_value_withdrawal_alert',
        recipient_user_id: undefined,
        variables: {
          currency, amount: fmtAmount, net_amount: fmtNet, fee: new Intl.NumberFormat('fr-CM').format(fee),
          destination: destName, destination_type, provider: providerName, tx_ref: txRef, user_email: user.email || 'N/A',
        },
      });
    }

    // ═══ EMAIL: Consumer withdrawal confirmation ═══
    sendManagedEmail(supabase, {
      email_key: payoutStatus === 'completed' ? 'consumer_withdrawal_completed' : 'consumer_withdrawal_initiated',
      recipient_user_id: user.id,
      variables: {
        currency, amount: fmtAmount, net_amount: fmtNet, fee: new Intl.NumberFormat('fr-CM').format(fee),
        destination: destName, destination_type, provider: providerName, tx_ref: txRef,
      },
    });

    const responseBody = {
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
    };

    // Store idempotency key to prevent double-debit on retries
    if (idempotencyKey) {
      await supabase.from('idempotency_keys').insert({
        idempotency_key: idempotencyKey,
        response_body: responseBody,
        response_status: 201,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).then(() => {}).catch(() => {});
    }

    return new Response(JSON.stringify(responseBody), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Withdrawal error:', err);
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] process-withdrawal error:`, err);
    return new Response(JSON.stringify({
      error: 'internal_error',
      error_id: errorId,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});