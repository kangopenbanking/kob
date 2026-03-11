import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwavePayout, calculateGatewayFee } from "../_shared/gateway-adapters.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { sendManagedEmail } from '../_shared/send-managed-email.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { merchant_id, amount, currency = 'XAF', channel, beneficiary_name, beneficiary_account, beneficiary_bank, beneficiary_phone, narration, tx_ref, metadata } = body;

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

    const { fee } = await calculateGatewayFee(amount, channel, supabase);
    const totalDebit = amount + fee;

    // Balance check — prevent payouts exceeding available funds
    const { data: wallet } = await supabase
      .from('gateway_merchant_wallets')
      .select('available_balance')
      .eq('merchant_id', merchant_id)
      .eq('currency', currency)
      .maybeSingle();

    if (!wallet || wallet.available_balance < totalDebit) {
      return new Response(JSON.stringify({ error: 'insufficient_balance', message: `Requires ${totalDebit}, available: ${wallet?.available_balance || 0}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: payout, error: insertErr } = await supabase.from('gateway_payouts').insert({
      merchant_id, amount, currency, channel, status: 'pending', provider: 'flutterwave',
      beneficiary_name, beneficiary_account, beneficiary_bank, beneficiary_phone,
      narration, tx_ref, fee_amount: fee, metadata: metadata || {},
      idempotency_key: idempotencyKey,
    }).select().single();

    if (insertErr) throw insertErr;

    // Debit merchant wallet BEFORE calling provider (atomic debit-then-send pattern)
    await supabase.rpc('update_merchant_wallet', {
      _merchant_id: merchant_id,
      _currency: currency,
      _available_delta: -totalDebit,
      _ledger_delta: -totalDebit,
    });

    try {
      const result = await createFlutterwavePayout({ amount, currency, channel, beneficiary_account, beneficiary_bank, beneficiary_phone, beneficiary_name, narration, tx_ref });
      await supabase.from('gateway_payouts').update({ status: result.status, provider_ref: result.provider_ref, provider_raw: result.provider_raw }).eq('id', payout.id);
      payout.status = result.status;
      payout.provider_ref = result.provider_ref;
    } catch (providerErr) {
      await supabase.from('gateway_payouts').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', payout.id);
      payout.status = 'failed';
      payout.failure_reason = providerErr.message;
    }

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_payout_created', entity_type: 'gateway_payout', entity_id: payout.id,
      performed_by: user.id, details: { merchant_id, amount, channel, status: payout.status, tx_ref },
    }).then(() => {}).catch(() => {});

    // ✉️ Email merchant: payout initiated or failed
    const payoutEmailKey = payout.status === 'failed' ? 'payout_failed' : 'payout_initiated';
    sendManagedEmail(supabase, {
      email_key: payoutEmailKey,
      recipient_user_id: merchant.user_id,
      variables: {
        merchant_name: merchant.business_name,
        currency, amount: new Intl.NumberFormat('fr-CM').format(amount),
        channel, beneficiary_name: beneficiary_name || 'N/A',
        tx_ref, fee: new Intl.NumberFormat('fr-CM').format(fee),
        failure_reason: payout.failure_reason || 'N/A',
      },
    });

    // ✉️ Admin alert for high-value payouts (>= 5M XAF)
    if (amount >= 5000000) {
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      for (const admin of (admins || [])) {
        sendManagedEmail(supabase, {
          email_key: 'high_value_payout_alert',
          recipient_user_id: admin.user_id,
          variables: {
            merchant_name: merchant.business_name,
            currency, amount: new Intl.NumberFormat('fr-CM').format(amount),
            channel, beneficiary_name: beneficiary_name || 'N/A',
          },
        });
      }
    }

    return new Response(JSON.stringify(payout), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] create-payout error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
