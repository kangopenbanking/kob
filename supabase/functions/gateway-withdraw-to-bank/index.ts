import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwavePayout, calculateGatewayFee } from "../_shared/gateway-adapters.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins } from "../_shared/admin-notify.ts";
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

    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { amount, account_id, bank_code, account_number, beneficiary_name, narration, channel = 'bank_transfer', preferred_rail, swift_bic } = body;

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

    // Check balance — use platform standard: read latest Credit ClosingAvailable/InterimAvailable
    const { data: balanceRecord } = await supabase.from('account_balances')
      .select('*')
      .eq('account_id', account_id)
      .eq('credit_debit_indicator', 'Credit')
      .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
      .order('balance_datetime', { ascending: false })
      .limit(1)
      .maybeSingle();

    const availableBalance = balanceRecord?.amount || 0;

    // Fee calculation
    const { fee, net } = await calculateGatewayFee(amount, channel, supabase);
    const totalDebit = amount + fee;

    // ═══ WITHDRAWAL POLICY CHECK (non-breaking enhancement) ═══
    if (account.institution_id) {
      try {
        const { data: policyResult } = await supabase.rpc('evaluate_withdrawal_policy', {
          _institution_id: account.institution_id,
          _branch_id: null,
          _staff_user_id: user.id,
          _amount: amount,
          _currency: account.currency || 'XAF',
          _channel: channel,
        });

        if (policyResult && policyResult.allowed === false) {
          const { data: wr } = await supabase.from('withdrawal_requests').insert({
            institution_id: account.institution_id, account_id, initiated_by_user_id: user.id,
            amount, currency: account.currency, channel, source_type: 'gateway',
            source_endpoint: 'gateway-withdraw-to-bank',
            current_status: 'pending_branch_manager', policy_result: policyResult,
            required_role: policyResult.escalation_target || 'branch_manager',
            reason: `Bank withdrawal exceeds policy: ${amount} ${account.currency}`,
          }).select().single();

          if (wr) {
            await supabase.from('approval_requests').insert({
              institution_id: account.institution_id, entity_type: 'withdrawal_request',
              entity_id: wr.id, request_type: 'withdrawal_override',
              current_stage: 'pending_branch_manager',
              required_role: policyResult.escalation_target || 'branch_manager',
              submitted_by: user.id, status: 'pending_branch_manager',
              reason: wr.reason,
            });
          }

          return new Response(JSON.stringify({
            requires_approval: true, withdrawal_request_id: wr?.id,
            message: `Withdrawal requires ${policyResult.escalation_target || 'manager'} approval`,
            policy_evaluation: policyResult,
          }), { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (policyErr) {
        console.error('Policy evaluation failed (non-blocking):', policyErr);
      }
    }

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

    // F53 — Atomic debit (row-locked) replaces raw UPDATE to prevent race conditions
    const { data: debitRes, error: debitErr } = await supabase.rpc('atomic_consumer_withdrawal_debit', {
      _balance_id: balanceRecord.id,
      _debit_amount: totalDebit,
    });
    if (debitErr || !debitRes?.success) {
      return new Response(JSON.stringify({ error: 'debit_failed', message: debitRes?.error || debitErr?.message || 'Debit failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    // ─── Phase 25 — KOB rail attempt with Flutterwave fallback ───
    const railSelection = await selectBankPayoutRail({
      supabase,
      bank_code,
      swift_bic,
      environment: (Deno.env.get('KOB_RAIL_ENV') as 'sandbox' | 'live') || 'sandbox',
      preferred_rail: (preferred_rail as any) || 'auto',
      source_account: 'KANG-PLATFORM',
    });
    console.log('[withdraw-to-bank] rail decision', describeRailDecision(railSelection));

    let payoutResult: any;
    let providerName: 'flutterwave' | string = 'flutterwave';
    try {
      if (railSelection.rail === 'kob_open_banking' && railSelection.execute) {
        try {
          const kob = await railSelection.execute({
            to_account: account_number,
            amount,
            currency: account.currency,
            reference: txRef,
            description: narration || `KOB Open Banking payout`,
            beneficiary_name,
            beneficiary_bank_code: bank_code,
          });
          if (!kob.success) throw new Error(kob.error || 'KOB connector returned failure');
          providerName = `kob:${railSelection.adapter_type}`;
          payoutResult = {
            provider_ref: kob.bank_tx_id || txRef,
            status: kob.status === 'executed' ? 'successful' : 'pending',
            provider_raw: { ...kob, rail: describeRailDecision(railSelection) },
          };
        } catch (kobErr: any) {
          console.warn(`[withdraw-to-bank] KOB rail failed, falling back: ${kobErr.message}`);
          payoutResult = await createFlutterwavePayout({
            amount, currency: account.currency, channel,
            beneficiary_account: account_number,
            beneficiary_bank: bank_code,
            beneficiary_name,
            narration: narration || `Withdrawal from KOB account (KOB fallback)`,
            tx_ref: txRef,
          });
          payoutResult.provider_raw = { ...payoutResult.provider_raw, kob_attempt_failed: kobErr.message, rail_decision: describeRailDecision(railSelection) };
        }
      } else {
        payoutResult = await createFlutterwavePayout({
          amount, currency: account.currency, channel,
          beneficiary_account: account_number,
          beneficiary_bank: bank_code,
          beneficiary_name,
          narration: narration || `Withdrawal from KOB account`,
          tx_ref: txRef,
        });
        payoutResult.provider_raw = { ...payoutResult.provider_raw, rail_decision: describeRailDecision(railSelection) };
      }
    } catch (payoutErr: any) {
      // F53 — Atomic reversal (adds back debit instead of overwriting) prevents lost concurrent credits
      await supabase.rpc('atomic_consumer_withdrawal_reverse', {
        _balance_id: balanceRecord.id,
        _reverse_amount: totalDebit,
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
      provider: providerName,
      provider_ref: payoutResult.provider_ref,
      provider_raw: payoutResult.provider_raw,
      beneficiary_name, beneficiary_phone: null,
      beneficiary_account: account_number,
      beneficiary_bank: bank_code,
      tx_ref: txRef, fee_amount: fee,
      metadata: { withdraw_to_bank: true, account_id, user_id: user.id },
    }).select().single();

    // F52 — Record fee for billing
    if (fee > 0) {
      await recordTransactionFee({
        supabase,
        institutionId: account.institution_id || null,
        transactionType: 'withdrawal',
        transactionRef: txRef,
        transactionAmount: amount,
        transactionCurrency: account.currency,
        feeModel: 'hybrid',
        calculatedFee: fee,
        finalFee: fee,
        metadata: { destination_type: 'bank_account', provider: providerName, bank_code, payout_id: payout?.id },
      });
    }

    // F54 — Trigger bank reconciliation poll for KOB rail so the bank-side balance
    // is reflected in our ledger as soon as the upstream bank acknowledges.
    if (providerName.startsWith('kob:') && railSelection.bank_id) {
      supabase.functions.invoke('bank-data-poller', {
        body: { bank_id: railSelection.bank_id, reason: 'post_payout_refresh', tx_ref: txRef },
      }).then(() => {}).catch(() => {});
    }

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_withdraw_initiated', entity_type: 'account', entity_id: account_id,
      performed_by: user.id, details: { amount, fee, bank_code, account_number, tx_ref: txRef, provider_status: payoutResult.status, provider: providerName, rail: describeRailDecision(railSelection) },
    }).then(() => {}).catch(() => {});

    // ═══ ADMIN ALERT ═══
    const fmtAmt = new Intl.NumberFormat('fr-CM').format(amount);
    notifyAdmins(supabase, {
      event_type: 'withdrawal_initiated',
      entity_type: 'account',
      entity_id: account_id,
      title: amount >= 1000000 ? '🔴 High-Value Bank Withdrawal' : '💸 Bank Withdrawal',
      message: `${account.currency} ${fmtAmt} withdrawal to ${beneficiary_name} (${account_number}). Ref: ${txRef}`,
      metadata: { user_id: user.id, amount, fee, bank_code, account_number, tx_ref: txRef },
    });

    // ═══ EMAIL: Confirmation to user ═══
    sendManagedEmail(supabase, {
      email_key: 'consumer_withdrawal_initiated',
      recipient_user_id: user.id,
      variables: { currency: account.currency, amount: fmtAmt, destination: beneficiary_name, destination_type: 'bank_account', tx_ref: txRef },
    });

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
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] withdraw-to-bank error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
