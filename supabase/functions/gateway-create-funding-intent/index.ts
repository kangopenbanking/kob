import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwaveCharge, createStripeCharge, calculateGatewayFee, getPayPalAccessToken } from "../_shared/gateway-adapters.ts";
import { sumUsageForPeriod, validateAmountRange } from "../_shared/limits-enforcement.ts";
import { recordTransactionFee } from "../_shared/record-transaction-fee.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

// Scope-aware fee calculation — now async with DB lookup
async function calculateScopedFee(amount: number, method: string, scope: string, supabaseClient: any, opts?: { merchantId?: string; institutionId?: string }) {
  const feeChannel = method === 'paypal' ? 'paypal' : method === 'card' ? 'card' : method === 'bank_transfer' ? 'bank_transfer' : 'account_funding';
  return await calculateGatewayFee(amount, feeChannel, supabaseClient, opts);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');

    const body = await req.json();
    const { amount, currency = 'XAF', method, provider, account_id, return_url, metadata = {}, bank_code, bank_name, bank_source } = body;
    const fundingScope = body.funding_scope || 'end_user';
    const merchantId = body.merchant_id || null;
    const targetDescription = body.target_description || null;
    const customerPhone = body.customer?.phone;
    const customerEmail = body.customer?.email;
    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;

    // Validate basics
    if (!amount || amount <= 0) return new Response(JSON.stringify({ error: 'invalid_amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!method || !['mobile_money', 'card', 'paypal', 'bank_transfer'].includes(method)) {
      return new Response(JSON.stringify({ error: 'invalid_method', message: 'Must be mobile_money, card, paypal, or bank_transfer' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!['end_user', 'merchant', 'institution', 'external_api'].includes(fundingScope)) {
      return new Response(JSON.stringify({ error: 'invalid_funding_scope' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let userId: string | null = null;
    let institutionId: string | null = null;
    let apiClientId: string | null = null;
    let accountId = account_id;

    // ─── Auth & Validation per scope ───
    if (fundingScope === 'external_api') {
      // OAuth access_token path: look up token in access_tokens table
      const { data: accessToken } = await supabase
        .from('access_tokens')
        .select('client_id, scope, expires_at, is_revoked')
        .eq('token_hash', token)
        .single();

      if (!accessToken || accessToken.is_revoked || new Date(accessToken.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'unauthorized', message: 'Invalid or expired access token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!accessToken.scope?.includes('funding:write')) {
        return new Response(JSON.stringify({ error: 'insufficient_scope', message: 'Token requires funding:write scope' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      apiClientId = accessToken.client_id;

      // Resolve client_id → institution
      const { data: apiClient } = await supabase.from('api_clients').select('institution_id').eq('client_id', apiClientId).single();
      if (!apiClient?.institution_id) {
        return new Response(JSON.stringify({ error: 'no_institution_mapping' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      institutionId = apiClient.institution_id;

      // Validate account belongs to this institution
      if (!accountId) return new Response(JSON.stringify({ error: 'missing_account_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: account } = await supabase.from('accounts').select('id, user_id, institution_id').eq('id', accountId).eq('institution_id', institutionId).single();
      if (!account) return new Response(JSON.stringify({ error: 'account_not_found', message: 'Account not found in your institution' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      userId = account.user_id;

    } else {
      // Accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
      const __authResult = await resolveAuth(req, supabase);
      if (__authResult.response) return __authResult.response;
      userId = __authResult.auth!.user_id;

      if (fundingScope === 'merchant') {
        if (!merchantId) return new Response(JSON.stringify({ error: 'missing_merchant_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        // Validate merchant ownership
        const { data: merchant } = await supabase.from('gateway_merchants').select('id, user_id').eq('id', merchantId).eq('user_id', userId).single();
        if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found', message: 'Merchant not found or not owned by you' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        // Merchant funding doesn't require account_id — wallet is credited directly
        accountId = accountId || null;

      } else if (fundingScope === 'institution') {
        if (!accountId) return new Response(JSON.stringify({ error: 'missing_account_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        // Validate institution ownership or staff assignment
        const { data: account } = await supabase.from('accounts').select('id, user_id, institution_id').eq('id', accountId).single();
        if (!account?.institution_id) return new Response(JSON.stringify({ error: 'account_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        institutionId = account.institution_id;
        const isOwner = await supabase.from('institutions').select('id').eq('id', institutionId).eq('user_id', userId).maybeSingle();
        const isStaff = await supabase.from('staff_assignments').select('id').eq('institution_id', institutionId).eq('user_id', userId).eq('is_active', true).maybeSingle();
        if (!isOwner.data && !isStaff.data) {
          return new Response(JSON.stringify({ error: 'unauthorized', message: 'Not authorized for this institution' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

      } else {
        // end_user scope
        if (!accountId) return new Response(JSON.stringify({ error: 'missing_account_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const { data: account } = await supabase.from('accounts').select('id, user_id, institution_id').eq('id', accountId).eq('user_id', userId).single();
        if (!account) return new Response(JSON.stringify({ error: 'account_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        institutionId = account.institution_id;
      }
    }

    // Idempotency check
    if (idempotencyKey) {
      let idemQuery = supabase.from('funding_intents').select('*').eq('idempotency_key', idempotencyKey).eq('funding_scope', fundingScope);
      if (accountId) idemQuery = idemQuery.eq('account_id', accountId);
      if (merchantId) idemQuery = idemQuery.eq('merchant_id', merchantId);
      const { data: existing } = await idemQuery.maybeSingle();
      if (existing) {
        return new Response(JSON.stringify(existing), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Fee calculation per scope (institution-aware)
    const feeResult = await calculateScopedFee(amount, method, fundingScope, supabase, { merchantId, institutionId: institutionId || undefined });
    const { fee, net, limits, commissions, components } = feeResult;

    const rangeError = validateAmountRange(amount, limits);
    if (rangeError) {
      return new Response(JSON.stringify({ error: 'amount_limit_violation', message: rangeError, limits }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (limits?.daily_limit && limits.daily_limit > 0) {
      const dailyTotal = await sumUsageForPeriod({
        supabase,
        table: 'funding_intents',
        filters: {
          funding_scope: fundingScope,
          ...(accountId ? { account_id: accountId } : {}),
          ...(merchantId ? { merchant_id: merchantId } : {}),
          ...(apiClientId ? { api_client_id: apiClientId } : {}),
        },
        statuses: ['created', 'pending_provider', 'pending_customer_action', 'pending_verification', 'succeeded'],
        period: 'day',
      });

      if (dailyTotal + amount > limits.daily_limit) {
        return new Response(JSON.stringify({ error: 'daily_limit_exceeded', message: `Daily limit of ${limits.daily_limit} exceeded`, limits }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (limits?.monthly_limit && limits.monthly_limit > 0) {
      const monthlyTotal = await sumUsageForPeriod({
        supabase,
        table: 'funding_intents',
        filters: {
          funding_scope: fundingScope,
          ...(accountId ? { account_id: accountId } : {}),
          ...(merchantId ? { merchant_id: merchantId } : {}),
          ...(apiClientId ? { api_client_id: apiClientId } : {}),
        },
        statuses: ['created', 'pending_provider', 'pending_customer_action', 'pending_verification', 'succeeded'],
        period: 'month',
      });

      if (monthlyTotal + amount > limits.monthly_limit) {
        return new Response(JSON.stringify({ error: 'monthly_limit_exceeded', message: `Monthly limit of ${limits.monthly_limit} exceeded`, limits }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const txRef = `fi_${(accountId || merchantId || 'api').toString().slice(0, 8)}_${Date.now()}`;
    let providerRef = '';
    let nextAction: Record<string, unknown> | null = null;
    let status = 'pending_provider';

    const resolvedProvider = provider || (method === 'mobile_money' ? 'flutterwave' : method === 'card' ? 'stripe' : method === 'paypal' ? 'paypal' : 'bank');

    // Route by provider
    if (resolvedProvider === 'flutterwave') {
      const result = await createFlutterwaveCharge({
        amount, currency, channel: method, customer_phone: customerPhone,
        customer_email: customerEmail || 'customer@kob.cm', tx_ref: txRef,
        metadata: { ...metadata, funding_intent: true, account_id: accountId, user_id: userId, funding_scope: fundingScope, merchant_id: merchantId, redirect_url: return_url },
      });
      providerRef = result.provider_ref;
      if (result.redirect_url) {
        nextAction = { type: 'redirect', redirect_url: result.redirect_url };
        status = 'pending_customer_action';
      } else {
        // Mobile money USSD/STK-push flow — no redirect, user confirms on phone
        nextAction = { type: 'mobile_money_confirm', message: 'Confirm the payment on your phone', provider_ref: result.provider_ref };
        status = 'pending_customer_action';
      }
    } else if (resolvedProvider === 'stripe') {
      const result = await createStripeCharge({
        amount, currency, channel: 'card', customer_email: customerEmail, tx_ref: txRef,
        metadata: { ...metadata, funding_intent: 'true', account_id: accountId || '', user_id: userId || '', funding_scope: fundingScope, merchant_id: merchantId || '' },
      });
      providerRef = result.provider_ref;
      nextAction = { type: 'stripe_confirm', client_secret: result.provider_raw?.client_secret };
      status = 'pending_customer_action';
    } else if (resolvedProvider === 'paypal') {
      const ppToken = await getPayPalAccessToken();
      const orderRes = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ppToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: txRef,
            amount: { currency_code: currency === 'XAF' ? 'EUR' : currency, value: (amount / 655.957).toFixed(2) },
            description: fundingScope === 'merchant' ? `Fund merchant wallet` : `Fund KOB account ${(accountId || '').slice(0, 8)}`,
          }],
          application_context: {
            return_url: return_url || 'https://kangopenbanking.com/gateway/callback',
            cancel_url: return_url || 'https://kangopenbanking.com/gateway/callback?cancelled=true',
          },
        }),
      });
      const orderData = await orderRes.json();
      providerRef = orderData.id || '';
      const approvalUrl = orderData.links?.find((l: any) => l.rel === 'approve')?.href;
      nextAction = { type: 'redirect', approval_url: approvalUrl };
      status = 'pending_customer_action';
    } else if (resolvedProvider === 'bank') {
      const bankRef = `KOBFUND-${txRef.slice(-8).toUpperCase()}`;
      providerRef = bankRef;
      const resolvedBankName = bank_name || 'Bank Transfer';
      const resolvedBankCode = bank_code || 'GENERIC';
      const isKobBank = bank_source === 'kob' || bank_source === 'linked';
      nextAction = {
        type: 'bank_transfer_instructions',
        bank_name: resolvedBankName,
        bank_code: resolvedBankCode,
        account_number: '10005 00041 09200950141 92',
        account_name: 'Kang Open Banking SA',
        reference: bankRef,
        amount, currency,
        is_kob_partner: isKobBank,
        instructions: isKobBank
          ? `Transfer exactly ${amount} ${currency} via ${resolvedBankName} (KOB partner). Reference: ${bankRef}. Funds credited instantly.`
          : `Transfer exactly ${amount} ${currency} to the account above with reference: ${bankRef}. Funds will be credited within 24-48 hours after verification.`,
      };
      status = isKobBank ? 'pending_customer_action' : 'pending_verification';
    }

    // Build target description
    const autoDescription = targetDescription || (
      fundingScope === 'merchant' ? 'Merchant wallet top-up' :
      fundingScope === 'institution' ? 'Institution account funding' :
      fundingScope === 'external_api' ? 'External API account credit' :
      'End-user account funding'
    );

    // Insert intent
    const intentData: Record<string, unknown> = {
      user_id: userId, institution_id: institutionId,
      amount, currency, method, provider: resolvedProvider, status,
      reference: txRef, idempotency_key: idempotencyKey || null,
      provider_reference: providerRef, fee_amount: fee, net_amount: net,
      next_action: nextAction, return_url, metadata: { ...(metadata || {}), fee_components: components || null, commissions: commissions || null, limits: limits || null },
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      funding_scope: fundingScope,
      merchant_id: merchantId,
      api_client_id: apiClientId,
      target_description: autoDescription,
    };
    if (accountId) intentData.account_id = accountId;

    const { data: intent, error: insertErr } = await supabase.from('funding_intents').insert(intentData).select().single();
    if (insertErr) throw insertErr;

    // Record event
    await supabase.from('funding_events').insert({
      funding_intent_id: intent.id, event_type: 'created',
      payload: { method, provider: resolvedProvider, amount, currency, funding_scope: fundingScope },
    });

    // Record transaction fee for billing/invoicing
    if (institutionId && fee > 0) {
      recordTransactionFee({
        supabase,
        institutionId,
        transactionType: `funding_${method}`,
        transactionRef: txRef,
        transactionAmount: amount,
        transactionCurrency: currency,
        feeModel: 'hybrid',
        calculatedFee: fee,
        finalFee: fee,
        feeBreakdown: { fee_amount: fee, net_amount: net, method, provider: resolvedProvider, ...(components || {}) },
        metadata: { funding_intent_id: intent.id, funding_scope: fundingScope, merchant_id: merchantId },
      }).catch(() => {});
    }

    return new Response(JSON.stringify(intent), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] Create funding intent error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
