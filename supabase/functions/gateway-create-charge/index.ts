import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwaveCharge, createStripeCharge, calculateGatewayFee } from "../_shared/gateway-adapters.ts";
import { recordTransactionFee } from "../_shared/record-transaction-fee.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { sendManagedEmail } from '../_shared/send-managed-email.ts';
import { resolveAuth } from "../_shared/auth-api-key.ts";
import { buildNextAction } from "../_shared/charge-next-action.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const authResult = await resolveAuth(req, supabase);
    if (authResult.response) return authResult.response;
    const auth = authResult.auth!;
    const user = { id: auth.user_id, email: auth.email };

    const body = await req.json();
    let {
      merchant_id, amount, currency = 'XAF', channel, customer_email, customer_phone, customer_name,
      tx_ref, metadata, payment_link_id, subaccounts, settlement_currency,
      save_token, customer_id, fee_bearer, capture_mode,
    } = body;

    // Auto-resolve merchant_id from API key if omitted (Stripe-style ergonomics)
    if (!merchant_id && auth.merchant_id) merchant_id = auth.merchant_id;

    // Validate channel
    const validChannels = ['mobile_money', 'card', 'bank_transfer', 'apple_pay', 'google_pay', 'ussd', 'paypal'];
    if (channel && !validChannels.includes(channel)) {
      return new Response(JSON.stringify({ error: 'invalid_channel', message: `Channel must be one of: ${validChannels.join(', ')}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!merchant_id || !amount || !channel || !tx_ref) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'merchant_id, amount, channel, tx_ref are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify merchant ownership
    const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // ─── Limit & Velocity Checks ───
    if (merchant.single_charge_limit && amount > merchant.single_charge_limit) {
      return new Response(JSON.stringify({ error: 'limit_exceeded', message: `Amount exceeds single charge limit of ${merchant.single_charge_limit}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (merchant.daily_charge_limit) {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const { data: dailyCharges } = await supabase.from('gateway_charges').select('amount').eq('merchant_id', merchant_id).gte('created_at', todayStart.toISOString()).in('status', ['pending', 'processing', 'successful']);
      const dailyTotal = (dailyCharges || []).reduce((sum, c) => sum + (c.amount || 0), 0);
      if (dailyTotal + amount > merchant.daily_charge_limit) {
        return new Response(JSON.stringify({ error: 'daily_limit_exceeded', message: `Daily charge limit of ${merchant.daily_charge_limit} would be exceeded` }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (merchant.velocity_max_charges && merchant.velocity_window_minutes) {
      const windowStart = new Date(Date.now() - merchant.velocity_window_minutes * 60 * 1000).toISOString();
      const { count } = await supabase.from('gateway_charges').select('id', { count: 'exact', head: true }).eq('merchant_id', merchant_id).gte('created_at', windowStart);
      if ((count || 0) >= merchant.velocity_max_charges) {
        return new Response(JSON.stringify({ error: 'velocity_exceeded', message: `Max ${merchant.velocity_max_charges} charges per ${merchant.velocity_window_minutes} minutes exceeded` }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Idempotency
    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;
    if (idempotencyKey) {
      const { data: existing } = await supabase.from('gateway_charges').select('*').eq('idempotency_key', idempotencyKey).eq('merchant_id', merchant_id).maybeSingle();
      if (existing) return new Response(JSON.stringify(existing), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
    }

    // Payment link validation
    if (payment_link_id) {
      const { data: link } = await supabase.from('gateway_payment_links').select('*').eq('id', payment_link_id).eq('merchant_id', merchant_id).single();
      if (!link) return new Response(JSON.stringify({ error: 'payment_link_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (link.status !== 'active') return new Response(JSON.stringify({ error: 'payment_link_inactive' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (link.expires_at && new Date(link.expires_at) < new Date()) return new Response(JSON.stringify({ error: 'payment_link_expired' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (link.max_uses && link.use_count >= link.max_uses) return new Response(JSON.stringify({ error: 'payment_link_exhausted' }), { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Increment use count
      await supabase.from('gateway_payment_links').update({ use_count: link.use_count + 1 }).eq('id', payment_link_id);
    }

    // Fee calculation
    const { fee, net } = await calculateGatewayFee(amount, channel, supabase, { merchantId: merchant.id });

    // Fee bearer: if customer bears the fee, the total charged increases
    const effectiveFeeBearer = fee_bearer || merchant.fee_bearer || 'merchant';
    const chargedAmount = effectiveFeeBearer === 'customer' ? amount + fee : amount;

    // FX rate for settlement currency
    let exchangeRate = null;
    let settledAmount = null;
    if (settlement_currency && settlement_currency !== currency) {
      try {
        const fxRes = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=${settlement_currency}`);
        const fxData = await fxRes.json();
        exchangeRate = fxData.rates?.[settlement_currency];
        if (exchangeRate) settledAmount = Math.round(net * exchangeRate * 100) / 100;
      } catch { /* FX lookup failed, proceed without */ }
    }

    // Determine provider
    const provider = channel === 'card' ? 'stripe' : 'flutterwave';

    // Capture mode
    const effectiveCaptureMode = capture_mode || 'auto';

    // Create charge record
    const { data: charge, error: insertErr } = await supabase.from('gateway_charges').insert({
      merchant_id, amount: chargedAmount, currency, channel, status: 'pending', provider,
      customer_email, customer_phone, customer_name, tx_ref,
      fee_amount: fee, net_amount: net, metadata: { ...(metadata || {}), fee_bearer: effectiveFeeBearer },
      idempotency_key: idempotencyKey,
      payment_link_id: payment_link_id || null,
      settlement_currency: settlement_currency || null,
      exchange_rate: exchangeRate,
      settled_amount: settledAmount,
      capture_mode: effectiveCaptureMode,
    }).select().single();

    if (insertErr) throw insertErr;

    // Charge event: created
    await supabase.from('gateway_charge_events').insert({
      charge_id: charge.id, event_type: 'charge.created',
      details: { channel, amount, currency, provider, payment_link_id, settlement_currency },
    }).then(() => {}).catch(() => {});

    // Call provider
    let providerResult;
    try {
      if (provider === 'flutterwave') {
        providerResult = await createFlutterwaveCharge({ amount, currency, channel, customer_email, customer_phone, customer_name, tx_ref, metadata });
      } else {
        providerResult = await createStripeCharge({ amount, currency, channel, customer_email, customer_phone, customer_name, tx_ref, metadata });
      }

      await supabase.from('gateway_charges').update({
        status: providerResult.status,
        provider_ref: providerResult.provider_ref,
        provider_raw: providerResult.provider_raw,
      }).eq('id', charge.id);

      charge.status = providerResult.status;
      charge.provider_ref = providerResult.provider_ref;

      // Charge event: provider responded
      await supabase.from('gateway_charge_events').insert({
        charge_id: charge.id, event_type: `charge.${providerResult.status}`,
        details: { provider_ref: providerResult.provider_ref },
      }).then(() => {}).catch(() => {});
    } catch (providerErr) {
      await supabase.from('gateway_charges').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', charge.id);
      charge.status = 'failed';
      charge.failure_reason = providerErr.message;

      await supabase.from('gateway_charge_events').insert({
        charge_id: charge.id, event_type: 'charge.failed',
        details: { error: providerErr.message },
      }).then(() => {}).catch(() => {});
    }

    // ─── Split Payments ───
    if (subaccounts && Array.isArray(subaccounts) && subaccounts.length > 0) {
      for (const split of subaccounts) {
        const { data: subaccount } = await supabase.from('gateway_subaccounts').select('*').eq('id', split.subaccount_id).eq('merchant_id', merchant_id).eq('is_active', true).single();
        if (!subaccount) continue;

        let splitAmount = 0;
        if (subaccount.split_type === 'percentage') {
          splitAmount = Math.round(net * subaccount.split_value / 100);
        } else {
          splitAmount = Math.min(subaccount.split_value, net);
        }

        await supabase.from('gateway_charge_splits').insert({
          charge_id: charge.id, subaccount_id: subaccount.id,
          split_type: subaccount.split_type, split_value: subaccount.split_value,
          split_amount: splitAmount,
        }).then(() => {}).catch(() => {});
      }
    }

    // ─── Save Token (after successful charge) ───
    if (save_token && customer_id && charge.status === 'successful' && providerResult) {
      try {
        const tokenData = providerResult.provider_raw?.data?.card || providerResult.provider_raw?.data?.authorization || {};
        await supabase.from('gateway_customer_tokens').insert({
          customer_id,
          token: tokenData.token || providerResult.provider_ref,
          channel,
          provider: charge.provider,
          last4: tokenData.last4 || tokenData.last_4digits || null,
          expiry: tokenData.expiry || null,
          metadata: { provider_ref: providerResult.provider_ref },
        }).then(() => {}).catch(() => {});
      } catch { /* token save is best-effort */ }
    }

    // ─── Payment Link Completion Event ───
    if (payment_link_id && charge.status === 'successful') {
      await supabase.from('gateway_charge_events').insert({
        charge_id: charge.id, event_type: 'payment_link.completed',
        details: { payment_link_id },
      }).then(() => {}).catch(() => {});
    }

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_charge_created', entity_type: 'gateway_charge', entity_id: charge.id,
      performed_by: user.id, details: { merchant_id, amount, channel, status: charge.status, tx_ref, payment_link_id, settlement_currency, save_token },
    }).then(() => {}).catch(() => {});

    // Record transaction fee for billing/invoicing
    if (charge.status !== 'failed') {
      const merchantInstitution = merchant.institution_id || null;
      recordTransactionFee({
        supabase,
        institutionId: merchantInstitution,
        transactionType: `gateway_charge_${channel}`,
        transactionRef: tx_ref,
        transactionAmount: amount,
        transactionCurrency: currency,
        feeModel: 'hybrid',
        calculatedFee: fee,
        finalFee: fee,
        feeBreakdown: { fee_amount: fee, net_amount: net, channel, provider },
        metadata: { charge_id: charge.id, merchant_id },
      }).catch(() => {});
    }

    // ✉️ Email merchant: payment received
    if (charge.status === 'successful') {
      sendManagedEmail(supabase, {
        email_key: 'payment_received',
        recipient_user_id: merchant.user_id,
        variables: {
          merchant_name: merchant.business_name,
          business_name: merchant.business_name,
          currency, amount: new Intl.NumberFormat('fr-CM').format(amount),
          tx_ref, channel, customer_name: customer_name || 'Customer',
          net_amount: new Intl.NumberFormat('fr-CM').format(net),
        },
      });

      // ✉️ Email consumer: payment receipt
      if (customer_email) {
        sendManagedEmail(supabase, {
          email_key: 'consumer_payment_receipt',
          recipient_email: customer_email,
          variables: {
            customer_name: customer_name || 'Customer',
            merchant_name: merchant.business_name,
            currency, amount: new Intl.NumberFormat('fr-CM').format(amount),
            tx_ref, channel,
          },
        });
      }
    }

    // Build channel-specific next_action so integrators know what to do next
    // (Stripe client_secret, bank account details, MoMo poll URL, PayPal approval URL).
    // Additive — STANDING ORDER 4. Restores P5 Working Code Rule for card / bank_transfer / paypal.
    const next_action = buildNextAction({
      channel,
      charge: { id: charge.id, status: charge.status, provider: charge.provider, provider_ref: charge.provider_ref },
      providerResult,
      customer_phone,
    });

    return new Response(JSON.stringify({ ...charge, next_action }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] create-charge error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
