// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwaveCharge, createStripeCharge, calculateGatewayFee, mapFlutterwaveStatus, mapStripeStatus, toStripeAmount } from "../_shared/gateway-adapters.ts";
import { recordTransactionFee } from "../_shared/record-transaction-fee.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";
import { sendManagedEmail } from '../_shared/send-managed-email.ts';

const jsonResp = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra } });

const errorResp = (error: string, status: number, detail?: string) =>
  jsonResp({ error, ...(detail ? { message: detail } : {}) }, status);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Determine action from body or query
    const url = new URL(req.url);
    let body: any = {};
    let action = url.searchParams.get('action') || '';

    if (req.method === 'POST') {
      body = await req.json();
      action = body.action || action || 'create';
    } else if (req.method === 'GET') {
      action = action || 'fee_estimate';
    }

    // fee_estimate does NOT require auth
    if (action === 'fee_estimate') {
      const amount = parseFloat(url.searchParams.get('amount') || body.amount || '0');
      const channel = url.searchParams.get('channel') || body.channel || 'mobile_money';
      const currency = url.searchParams.get('currency') || body.currency || 'XAF';
      const merchantId = url.searchParams.get('merchant_id') || body.merchant_id || undefined;
      const institutionId = url.searchParams.get('institution_id') || body.institution_id || undefined;

      if (!amount || amount <= 0) return errorResp('amount must be a positive number', 400);

      const result = await calculateGatewayFee(amount, channel, supabase, { merchantId, institutionId });

      return jsonResp({
        amount, currency, channel,
        fee_amount: result.fee,
        net_amount: result.net,
        fee_breakdown: {
          effective_rate: `${((result.fee) / amount * 100).toFixed(1)}%`,
          components: result.components || null,
          currency,
        },
        commissions: result.commissions || { agent: 0, referral: 0 },
        limits: result.limits || null,
      });
    }

    // All other actions require auth
    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const __auth = __authResult.auth!;
    const user = { id: __auth.user_id, email: __auth.email } as any;

    // ─── CREATE CHARGE ───
    if (action === 'create') {
      const {
        merchant_id, amount, currency = 'XAF', channel, customer_email, customer_phone, customer_name,
        tx_ref, metadata, payment_link_id, subaccounts, settlement_currency,
        save_token, customer_id, fee_bearer, capture_mode,
      } = body;

      const validChannels = ['mobile_money', 'card', 'bank_transfer', 'apple_pay', 'google_pay', 'ussd', 'paypal'];
      if (channel && !validChannels.includes(channel)) return errorResp('invalid_channel', 400, `Channel must be one of: ${validChannels.join(', ')}`);
      if (!merchant_id || !amount || !channel || !tx_ref) return errorResp('missing_fields', 400, 'merchant_id, amount, channel, tx_ref are required');

      const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return errorResp('merchant_not_found', 404);

      // Limit checks
      if (merchant.single_charge_limit && amount > merchant.single_charge_limit) return errorResp('limit_exceeded', 400, `Amount exceeds single charge limit of ${merchant.single_charge_limit}`);

      if (merchant.daily_charge_limit) {
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        const { data: dailyCharges } = await supabase.from('gateway_charges').select('amount').eq('merchant_id', merchant_id).gte('created_at', todayStart.toISOString()).in('status', ['pending', 'processing', 'successful']);
        const dailyTotal = (dailyCharges || []).reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
        if (dailyTotal + amount > merchant.daily_charge_limit) return jsonResp({ error: 'daily_limit_exceeded', message: `Daily charge limit of ${merchant.daily_charge_limit} would be exceeded` }, 429);
      }

      if (merchant.velocity_max_charges && merchant.velocity_window_minutes) {
        const windowStart = new Date(Date.now() - merchant.velocity_window_minutes * 60 * 1000).toISOString();
        const { count } = await supabase.from('gateway_charges').select('id', { count: 'exact', head: true }).eq('merchant_id', merchant_id).gte('created_at', windowStart);
        if ((count || 0) >= merchant.velocity_max_charges) return jsonResp({ error: 'velocity_exceeded', message: `Max ${merchant.velocity_max_charges} charges per ${merchant.velocity_window_minutes} minutes exceeded` }, 429);
      }

      // Idempotency
      const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;
      if (idempotencyKey) {
        const { data: existing } = await supabase.from('gateway_charges').select('*').eq('idempotency_key', idempotencyKey).eq('merchant_id', merchant_id).maybeSingle();
        if (existing) return jsonResp(existing, 200, { 'X-Idempotent-Replayed': 'true' });
      }

      // Payment link validation
      if (payment_link_id) {
        const { data: link } = await supabase.from('gateway_payment_links').select('*').eq('id', payment_link_id).eq('merchant_id', merchant_id).single();
        if (!link) return errorResp('payment_link_not_found', 404);
        if (link.status !== 'active') return errorResp('payment_link_inactive', 410);
        if (link.expires_at && new Date(link.expires_at) < new Date()) return errorResp('payment_link_expired', 410);
        if (link.max_uses && link.use_count >= link.max_uses) return errorResp('payment_link_exhausted', 410);
        await supabase.from('gateway_payment_links').update({ use_count: link.use_count + 1 }).eq('id', payment_link_id);
      }

      const { fee, net } = await calculateGatewayFee(amount, channel, supabase, { merchantId: merchant.id });
      const effectiveFeeBearer = fee_bearer || merchant.fee_bearer || 'merchant';
      const chargedAmount = effectiveFeeBearer === 'customer' ? amount + fee : amount;

      let exchangeRate = null;
      let settledAmount = null;
      if (settlement_currency && settlement_currency !== currency) {
        try {
          const fxRes = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=${settlement_currency}`);
          const fxData = await fxRes.json();
          exchangeRate = fxData.rates?.[settlement_currency];
          if (exchangeRate) settledAmount = Math.round(net * exchangeRate * 100) / 100;
        } catch { /* FX lookup failed */ }
      }

      const provider = channel === 'card' ? 'stripe' : 'flutterwave';
      const effectiveCaptureMode = capture_mode || 'auto';

      const { data: charge, error: insertErr } = await supabase.from('gateway_charges').insert({
        merchant_id, amount: chargedAmount, currency, channel, status: 'pending', provider,
        customer_email, customer_phone, customer_name, tx_ref,
        fee_amount: fee, net_amount: net, metadata: { ...(metadata || {}), fee_bearer: effectiveFeeBearer },
        idempotency_key: idempotencyKey, payment_link_id: payment_link_id || null,
        settlement_currency: settlement_currency || null, exchange_rate: exchangeRate,
        settled_amount: settledAmount, capture_mode: effectiveCaptureMode,
      }).select().single();
      if (insertErr) throw insertErr;

      await supabase.from('gateway_charge_events').insert({
        charge_id: charge.id, event_type: 'charge.created',
        details: { channel, amount, currency, provider, payment_link_id, settlement_currency },
      }).then(() => {}).catch(() => {});

      let providerResult: any;
      try {
        if (provider === 'flutterwave') {
          providerResult = await createFlutterwaveCharge({ amount, currency, channel, customer_email, customer_phone, customer_name, tx_ref, metadata });
        } else {
          providerResult = await createStripeCharge({ amount, currency, channel, customer_email, customer_phone, customer_name, tx_ref, metadata });
        }
        await supabase.from('gateway_charges').update({ status: providerResult.status, provider_ref: providerResult.provider_ref, provider_raw: providerResult.provider_raw }).eq('id', charge.id);
        charge.status = providerResult.status;
        charge.provider_ref = providerResult.provider_ref;
        await supabase.from('gateway_charge_events').insert({ charge_id: charge.id, event_type: `charge.${providerResult.status}`, details: { provider_ref: providerResult.provider_ref } }).then(() => {}).catch(() => {});
      } catch (providerErr: any) {
        await supabase.from('gateway_charges').update({ status: 'failed', failure_reason: providerErr.message }).eq('id', charge.id);
        charge.status = 'failed';
        charge.failure_reason = providerErr.message;
        await supabase.from('gateway_charge_events').insert({ charge_id: charge.id, event_type: 'charge.failed', details: { error: providerErr.message } }).then(() => {}).catch(() => {});
      }

      // Split payments
      if (subaccounts && Array.isArray(subaccounts) && subaccounts.length > 0) {
        for (const split of subaccounts) {
          const { data: subaccount } = await supabase.from('gateway_subaccounts').select('*').eq('id', split.subaccount_id).eq('merchant_id', merchant_id).eq('is_active', true).single();
          if (!subaccount) continue;
          let splitAmount = subaccount.split_type === 'percentage' ? Math.round(net * subaccount.split_value / 100) : Math.min(subaccount.split_value, net);
          await supabase.from('gateway_charge_splits').insert({ charge_id: charge.id, subaccount_id: subaccount.id, split_type: subaccount.split_type, split_value: subaccount.split_value, split_amount: splitAmount }).then(() => {}).catch(() => {});
        }
      }

      // Save token
      if (save_token && customer_id && charge.status === 'successful' && providerResult) {
        try {
          const tokenData = providerResult.provider_raw?.data?.card || providerResult.provider_raw?.data?.authorization || {};
          await supabase.from('gateway_customer_tokens').insert({ customer_id, token: tokenData.token || providerResult.provider_ref, channel, provider: charge.provider, last4: tokenData.last4 || tokenData.last_4digits || null, expiry: tokenData.expiry || null, metadata: { provider_ref: providerResult.provider_ref } }).then(() => {}).catch(() => {});
        } catch { /* best-effort */ }
      }

      if (payment_link_id && charge.status === 'successful') {
        await supabase.from('gateway_charge_events').insert({ charge_id: charge.id, event_type: 'payment_link.completed', details: { payment_link_id } }).then(() => {}).catch(() => {});
      }

      await supabase.from('audit_logs').insert({ action_type: 'gateway_charge_created', entity_type: 'gateway_charge', entity_id: charge.id, performed_by: user.id, details: { merchant_id, amount, channel, status: charge.status, tx_ref, payment_link_id, settlement_currency, save_token } }).then(() => {}).catch(() => {});

      if (charge.status !== 'failed') {
        const merchantInstitution = merchant.institution_id || null;
        recordTransactionFee({ supabase, institutionId: merchantInstitution, transactionType: `gateway_charge_${channel}`, transactionRef: tx_ref, transactionAmount: amount, transactionCurrency: currency, feeModel: 'hybrid', calculatedFee: fee, finalFee: fee, feeBreakdown: { fee_amount: fee, net_amount: net, channel, provider }, metadata: { charge_id: charge.id, merchant_id } }).catch(() => {});
      }

      if (charge.status === 'successful') {
        sendManagedEmail(supabase, { email_key: 'payment_received', recipient_user_id: merchant.user_id, variables: { merchant_name: merchant.business_name, business_name: merchant.business_name, currency, amount: new Intl.NumberFormat('fr-CM').format(amount), tx_ref, channel, customer_name: customer_name || 'Customer', net_amount: new Intl.NumberFormat('fr-CM').format(net) } });
        if (customer_email) {
          sendManagedEmail(supabase, { email_key: 'consumer_payment_receipt', recipient_email: customer_email, variables: { customer_name: customer_name || 'Customer', merchant_name: merchant.business_name, currency, amount: new Intl.NumberFormat('fr-CM').format(amount), tx_ref, channel } });
        }
      }

      return jsonResp(charge);
    }

    // ─── VERIFY CHARGE ───
    if (action === 'verify') {
      const chargeId = url.searchParams.get('id') || body.charge_id || body.id;
      if (!chargeId) return errorResp('id is required', 400);

      const { data: charge } = await supabase.from('gateway_charges').select('*, gateway_merchants!inner(user_id)').eq('id', chargeId).single();
      if (!charge || charge.gateway_merchants.user_id !== user.id) return errorResp('charge_not_found', 404);

      let providerStatus = charge.status;
      let providerData = null;

      if (charge.provider === 'flutterwave' && charge.provider_ref) {
        const FLW_SECRET = Deno.env.get('FLUTTERWAVE_SECRET_KEY');
        if (FLW_SECRET) {
          try {
            const res = await fetch(`https://api.flutterwave.com/v3/transactions/${charge.provider_ref}/verify`, { headers: { Authorization: `Bearer ${FLW_SECRET}` } });
            const data = await res.json();
            providerData = data;
            if (data.data?.status) providerStatus = mapFlutterwaveStatus(data.data.status);
          } catch (e) { console.error('FLW verify error:', e); }
        }
      }

      if (charge.provider === 'stripe' && charge.provider_ref) {
        const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY');
        if (STRIPE_SECRET) {
          try {
            const res = await fetch(`https://api.stripe.com/v1/payment_intents/${charge.provider_ref}`, { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } });
            const data = await res.json();
            providerData = data;
            if (data.status) providerStatus = mapStripeStatus(data.status);
          } catch (e) { console.error('Stripe verify error:', e); }
        }
      }

      if (providerStatus !== charge.status) {
        await supabase.from('gateway_charges').update({ status: providerStatus, provider_raw: providerData || charge.provider_raw, updated_at: new Date().toISOString() }).eq('id', chargeId);
      }

      const { gateway_merchants, ...chargeData } = charge;
      return jsonResp({ ...chargeData, status: providerStatus, verified: true, verified_at: new Date().toISOString() });
    }

    // ─── VALIDATE CHARGE (OTP) ───
    if (action === 'validate') {
      const { charge_id, otp, flw_ref } = body;
      if (!charge_id || !otp) return errorResp('missing_fields', 400, 'charge_id and otp are required');

      const { data: charge } = await supabase.from('gateway_charges').select('*, gateway_merchants!inner(user_id)').eq('id', charge_id).single();
      if (!charge || charge.gateway_merchants.user_id !== user.id) return errorResp('charge_not_found', 404);
      if (charge.status !== 'processing' && charge.status !== 'pending') return errorResp('invalid_state', 400, `Charge is already ${charge.status}`);

      const flutterwaveSecretKey = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;
      const ref = flw_ref || charge.provider_ref;
      const flwRes = await fetch('https://api.flutterwave.com/v3/validate-charge', { method: 'POST', headers: { 'Authorization': `Bearer ${flutterwaveSecretKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ otp, flw_ref: ref }) });
      const flwData = await flwRes.json();
      const newStatus = flwData.status === 'success' ? 'successful' : 'failed';

      await supabase.from('gateway_charges').update({ status: newStatus, provider_raw: flwData }).eq('id', charge.id);

      if (newStatus === 'successful') {
        await supabase.rpc('update_merchant_wallet', { _merchant_id: charge.merchant_id, _currency: charge.currency, _pending_delta: charge.net_amount || charge.amount, _ledger_delta: charge.net_amount || charge.amount });
      }

      await supabase.from('gateway_charge_events').insert({ charge_id: charge.id, event_type: `charge.${newStatus}`, details: { via: 'otp_validation', flw_ref: ref } }).then(() => {}).catch(() => {});

      return jsonResp({ id: charge.id, status: newStatus, message: flwData.message });
    }

    // ─── PREAUTH CHARGE ───
    if (action === 'preauth') {
      const { merchant_id, amount, currency = 'USD', customer_email, customer_name, tx_ref, metadata: preauthMeta } = body;
      if (!merchant_id || !amount || !tx_ref) return errorResp('missing_fields', 400, 'merchant_id, amount, tx_ref are required');

      const { data: merchant } = await supabase.from('gateway_merchants').select('*').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return errorResp('merchant_not_found', 404);

      const { fee, net } = await calculateGatewayFee(amount, 'card', supabase, { merchantId: merchant_id });

      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
      const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          amount: toStripeAmount(amount, currency).toString(),
          currency: currency.toLowerCase(),
          capture_method: 'manual',
          ...(customer_email ? { receipt_email: customer_email } : {}),
          'metadata[tx_ref]': tx_ref,
          'metadata[merchant_id]': merchant_id,
        }),
      });
      const piData = await stripeRes.json();
      if (piData.error) throw new Error(piData.error.message);

      const { data: charge } = await supabase.from('gateway_charges').insert({
        merchant_id, amount, currency, channel: 'card', status: 'authorized',
        provider: 'stripe', provider_ref: piData.id,
        customer_email, customer_name, tx_ref,
        fee_amount: fee, net_amount: net, metadata: preauthMeta || {},
        capture_mode: 'manual', captured_amount: 0,
      }).select().single();

      await supabase.from('gateway_charge_events').insert({ charge_id: charge.id, event_type: 'charge.authorized', details: { client_secret: piData.client_secret, provider_ref: piData.id } }).then(() => {}).catch(() => {});

      return jsonResp({ ...charge, client_secret: piData.client_secret });
    }

    return errorResp('invalid_action', 400, `Unknown action: ${action}. Valid: create, verify, validate, preauth, fee_estimate`);
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-charges-router error:`, err);
    return jsonResp({ error: 'internal_error', error_id: errorId }, 500);
  }
});
