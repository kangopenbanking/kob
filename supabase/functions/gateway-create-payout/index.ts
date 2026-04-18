import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwavePayout, calculateGatewayFee } from "../_shared/gateway-adapters.ts";
import { selectBankPayoutRail, describeRailDecision } from "../_shared/bank-payout-router.ts";
import { recordTransactionFee } from "../_shared/record-transaction-fee.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { sendManagedEmail } from '../_shared/send-managed-email.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    const internalSecret = req.headers.get('x-internal-secret');
    const onBehalfOf = req.headers.get('x-on-behalf-of');
    const expectedInternal = Deno.env.get('INTERNAL_FUNCTION_SECRET');

    let user: { id: string; email?: string } | null = null;
    if (internalSecret && expectedInternal && internalSecret === expectedInternal && onBehalfOf) {
      const { data: profile } = await supabase.from('profiles').select('id,email').eq('id', onBehalfOf).maybeSingle();
      if (profile) user = { id: profile.id, email: profile.email || undefined };
    } else {
      if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: { user: u } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (u) user = { id: u.id, email: u.email };
    }
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const {
      merchant_id, amount, currency = 'XAF', channel,
      beneficiary_name, beneficiary_account, beneficiary_bank, beneficiary_phone,
      narration, tx_ref, metadata,
      preferred_rail,        // Phase 26 — KOB rail option for merchant payouts
      swift_bic,
    } = body;

    if (!merchant_id || !amount || !channel || !tx_ref) {
      return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Daily payout limit check
    if (merchant.daily_payout_limit) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data: dailyPayouts } = await supabase.from('gateway_payouts').select('amount').eq('merchant_id', merchant_id).gte('created_at', todayStart.toISOString()).in('status', ['pending', 'processing', 'successful']);
      const dailyTotal = (dailyPayouts || []).reduce((sum, p) => sum + (p.amount || 0), 0);
      if (dailyTotal + amount > merchant.daily_payout_limit) {
        return new Response(JSON.stringify({ error: 'daily_payout_limit_exceeded', message: `Daily payout limit of ${merchant.daily_payout_limit} would be exceeded` }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;
    if (idempotencyKey) {
      const { data: existing } = await supabase.from('gateway_payouts').select('*').eq('idempotency_key', idempotencyKey).eq('merchant_id', merchant_id).maybeSingle();
      if (existing) return new Response(JSON.stringify(existing), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
    }

    const feeResult = await calculateGatewayFee(amount, channel, supabase, { merchantId: merchant_id, institutionId: merchant.institution_id || undefined });
    const fee = feeResult.fee;
    const totalDebit = amount + fee;

    // Balance check
    const { data: wallet } = await supabase
      .from('gateway_merchant_wallets')
      .select('available_balance')
      .eq('merchant_id', merchant_id)
      .eq('currency', currency)
      .maybeSingle();

    if (!wallet || wallet.available_balance < totalDebit) {
      return new Response(JSON.stringify({ error: 'insufficient_balance', message: `Requires ${totalDebit}, available: ${wallet?.available_balance || 0}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ─── Phase 26 — KOB rail selection for bank-channel payouts ───
    let railSelection: any = null;
    let providerName = 'flutterwave';
    if (channel === 'bank_transfer') {
      railSelection = await selectBankPayoutRail({
        supabase,
        bank_code: beneficiary_bank,
        swift_bic,
        environment: (Deno.env.get('KOB_RAIL_ENV') as 'sandbox' | 'live') || 'sandbox',
        preferred_rail: (preferred_rail as any) || 'auto',
        source_account: 'KANG-PLATFORM',
      });
      console.log('[create-payout] rail decision', describeRailDecision(railSelection));
    }

    const { data: payout, error: insertErr } = await supabase.from('gateway_payouts').insert({
      merchant_id, amount, currency, channel, status: 'pending', provider: providerName,
      beneficiary_name, beneficiary_account, beneficiary_bank, beneficiary_phone,
      narration, tx_ref, fee_amount: fee,
      metadata: { ...(metadata || {}), rail_decision: railSelection ? describeRailDecision(railSelection) : null },
      idempotency_key: idempotencyKey,
    }).select().single();

    if (insertErr) throw insertErr;

    // Debit merchant wallet BEFORE calling provider
    await supabase.rpc('update_merchant_wallet', {
      _merchant_id: merchant_id, _currency: currency,
      _available_delta: -totalDebit, _ledger_delta: -totalDebit,
    });

    let providerRaw: any = null;
    try {
      // Try KOB rail first for bank_transfer channel
      if (railSelection?.rail === 'kob_open_banking' && railSelection.execute) {
        try {
          const kob = await railSelection.execute({
            to_account: beneficiary_account || '',
            amount,
            currency,
            reference: tx_ref,
            description: narration || `KOB merchant payout`,
            beneficiary_name: beneficiary_name || merchant.business_name,
            beneficiary_bank_code: beneficiary_bank,
          });
          if (!kob.success) throw new Error(kob.error || 'KOB connector failure');
          providerName = `kob:${railSelection.adapter_type}`;
          providerRaw = { ...kob, rail: describeRailDecision(railSelection) };
          await supabase.from('gateway_payouts').update({
            status: kob.status === 'executed' ? 'successful' : 'processing',
            provider: providerName,
            provider_ref: kob.bank_tx_id || tx_ref,
            provider_raw: providerRaw,
          }).eq('id', payout.id);
          payout.status = kob.status === 'executed' ? 'successful' : 'processing';
          payout.provider_ref = kob.bank_tx_id || tx_ref;
        } catch (kobErr: any) {
          console.warn(`[create-payout] KOB failed, fallback to Flutterwave: ${kobErr.message}`);
          const result = await createFlutterwavePayout({ amount, currency, channel, beneficiary_account, beneficiary_bank, beneficiary_phone, beneficiary_name, narration, tx_ref });
          providerName = 'flutterwave';
          providerRaw = { ...result.provider_raw, kob_attempt_failed: kobErr.message, rail_decision: describeRailDecision(railSelection) };
          await supabase.from('gateway_payouts').update({ status: result.status, provider: providerName, provider_ref: result.provider_ref, provider_raw: providerRaw }).eq('id', payout.id);
          payout.status = result.status;
          payout.provider_ref = result.provider_ref;
        }
      } else {
        const result = await createFlutterwavePayout({ amount, currency, channel, beneficiary_account, beneficiary_bank, beneficiary_phone, beneficiary_name, narration, tx_ref });
        providerRaw = { ...result.provider_raw, rail_decision: railSelection ? describeRailDecision(railSelection) : null };
        await supabase.from('gateway_payouts').update({ status: result.status, provider_ref: result.provider_ref, provider_raw: providerRaw }).eq('id', payout.id);
        payout.status = result.status;
        payout.provider_ref = result.provider_ref;
      }
    } catch (providerErr: any) {
      // Reverse debit on hard failure
      await supabase.rpc('update_merchant_wallet', {
        _merchant_id: merchant_id, _currency: currency,
        _available_delta: totalDebit, _ledger_delta: totalDebit,
      });
      await supabase.from('gateway_payouts').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', payout.id);
      payout.status = 'failed';
      payout.failure_reason = providerErr.message;
    }

    // ─── Phase 26 F52 — Record fee for billing/Fees tab ───
    if (payout.status !== 'failed' && fee > 0) {
      await recordTransactionFee({
        supabase,
        institutionId: merchant.institution_id || null,
        transactionType: 'gateway_payout',
        transactionRef: tx_ref,
        transactionAmount: amount,
        transactionCurrency: currency,
        feeModel: 'hybrid',
        calculatedFee: fee,
        finalFee: fee,
        feeBreakdown: feeResult.components || undefined,
        metadata: { merchant_id, channel, provider: providerName, payout_id: payout.id },
      });
    }

    // ─── Phase 26 F54 — Trigger reconciliation poll for KOB rail ───
    if (providerName.startsWith('kob:') && railSelection?.bank_id) {
      supabase.functions.invoke('bank-data-poller', {
        body: { bank_id: railSelection.bank_id, reason: 'post_payout_refresh', tx_ref },
      }).then(() => {}).catch(() => {});
    }

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_payout_created', entity_type: 'gateway_payout', entity_id: payout.id,
      performed_by: user.id, details: { merchant_id, amount, channel, status: payout.status, tx_ref, provider: providerName, rail: railSelection ? describeRailDecision(railSelection) : null },
    }).then(() => {}).catch(() => {});

    // Email
    const payoutEmailKey = payout.status === 'failed' ? 'payout_failed' : 'payout_initiated';
    sendManagedEmail(supabase, {
      email_key: payoutEmailKey,
      recipient_user_id: merchant.user_id,
      variables: {
        merchant_name: merchant.business_name, currency,
        amount: new Intl.NumberFormat('fr-CM').format(amount),
        channel, beneficiary_name: beneficiary_name || 'N/A', tx_ref,
        fee: new Intl.NumberFormat('fr-CM').format(fee),
        failure_reason: payout.failure_reason || 'N/A',
      },
    });

    if (amount >= 5000000) {
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      for (const admin of (admins || [])) {
        sendManagedEmail(supabase, {
          email_key: 'high_value_payout_alert',
          recipient_user_id: admin.user_id,
          variables: {
            merchant_name: merchant.business_name, currency,
            amount: new Intl.NumberFormat('fr-CM').format(amount),
            channel, beneficiary_name: beneficiary_name || 'N/A',
          },
        });
      }
    }

    return new Response(JSON.stringify({ ...payout, provider: providerName }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] create-payout error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
