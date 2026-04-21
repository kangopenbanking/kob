import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAuth } from "../_shared/auth-api-key.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
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
    if (!authHeader) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { amount, currency = 'XAF', channel, source_phone, source_email, account_id, metadata } = body;

    // Validate required fields
    if (!amount || !channel || !account_id) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'amount, channel, account_id are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validChannels = ['mobile_money', 'card', 'bank_transfer'];
    if (!validChannels.includes(channel)) {
      return new Response(JSON.stringify({ error: 'invalid_channel', message: `Channel must be one of: ${validChannels.join(', ')}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({ error: 'invalid_amount', message: 'Amount must be greater than zero' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verify account belongs to user
    const { data: account } = await supabase.from('accounts').select('*').eq('id', account_id).eq('user_id', user.id).eq('is_active', true).single();
    if (!account) {
      return new Response(JSON.stringify({ error: 'account_not_found', message: 'Account not found or not active' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Idempotency
    const idempotencyKey = req.headers.get('idempotency-key');
    if (idempotencyKey) {
      const { data: existing } = await supabase.from('idempotency_keys').select('response_body').eq('idempotency_key', idempotencyKey).maybeSingle();
      if (existing) return new Response(JSON.stringify(existing.response_body), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' } });
    }

    // Fee calculation
    const { fee, net } = await calculateGatewayFee(amount, 'account_funding', supabase);

    // Generate unique reference
    const txRef = `fund_${account_id.substring(0, 8)}_${Date.now()}`;

    // Determine provider
    const provider = channel === 'card' ? 'stripe' : 'flutterwave';

    // Call provider
    let providerResult;
    try {
      if (provider === 'flutterwave') {
        providerResult = await createFlutterwaveCharge({
          amount, currency, channel,
          customer_phone: source_phone,
          customer_email: source_email || user.email,
          customer_name: account.account_holder_name,
          tx_ref: txRef,
          metadata: { ...(metadata || {}), fund_account: true, account_id, user_id: user.id, redirect_url: 'https://kangopenbanking.com/gateway/callback' },
        });
      } else {
        providerResult = await createStripeCharge({
          amount, currency, channel,
          customer_email: source_email || user.email,
          customer_name: account.account_holder_name,
          tx_ref: txRef,
          metadata: { ...(metadata || {}), fund_account: true, account_id, user_id: user.id },
        });
      }
    } catch (providerErr: any) {
      // Audit trail for failed attempt
      await supabase.from('audit_logs').insert({
        action_type: 'gateway_fund_account_failed', entity_type: 'account', entity_id: account_id,
        performed_by: user.id, details: { amount, channel, error: providerErr.message },
      }).then(() => {}).catch(() => {});

      return new Response(JSON.stringify({ error: 'provider_error', message: providerErr.message }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Record the funding transaction in gateway_charges for webhook correlation
    const { data: charge } = await supabase.from('gateway_charges').insert({
      merchant_id: null, // User-initiated, not merchant
      amount, currency, channel, status: providerResult.status,
      provider, provider_ref: providerResult.provider_ref,
      provider_raw: providerResult.provider_raw,
      customer_email: source_email || user.email,
      customer_phone: source_phone,
      customer_name: account.account_holder_name,
      tx_ref: txRef,
      fee_amount: fee, net_amount: net,
      metadata: { fund_account: true, account_id, user_id: user.id },
      idempotency_key: idempotencyKey,
    }).select().single();

    // If charge was immediately successful (rare), credit account now
    if (providerResult.status === 'successful') {
      await creditAccount(supabase, account_id, amount, currency, txRef, user.id);
    }

    // Audit trail
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_fund_account_initiated', entity_type: 'account', entity_id: account_id,
      performed_by: user.id, details: { amount, channel, tx_ref: txRef, status: providerResult.status, provider },
    }).then(() => {}).catch(() => {});

    // Build next_action for the client
    let next_action: Record<string, unknown> | null = null;
    if (provider === 'stripe' && providerResult.provider_raw?.client_secret) {
      next_action = { type: 'stripe_confirm', client_secret: providerResult.provider_raw.client_secret };
    } else if (providerResult.redirect_url) {
      next_action = { type: 'redirect', redirect_url: providerResult.redirect_url };
    }

    const response = {
      id: charge?.id,
      account_id,
      amount,
      currency,
      channel,
      provider,
      status: providerResult.status,
      fee_amount: fee,
      net_amount: net,
      tx_ref: txRef,
      redirect_url: providerResult.redirect_url,
      next_action,
      created_at: charge?.created_at,
    };

    // Store idempotency
    if (idempotencyKey) {
      await supabase.from('idempotency_keys').insert({
        idempotency_key: idempotencyKey,
        response_body: response,
        response_status: 200,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }).then(() => {}).catch(() => {});
    }

    return new Response(JSON.stringify(response), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] fund-account error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// Helper: credit user's account balance
async function creditAccount(supabase: any, accountId: string, amount: number, currency: string, txRef: string, userId: string) {
  const now = new Date().toISOString();

  // Upsert ClosingAvailable balance
  const { data: existing } = await supabase
    .from('account_balances')
    .select('id, amount')
    .eq('account_id', accountId)
    .eq('balance_type', 'ClosingAvailable')
    .eq('credit_debit_indicator', 'Credit')
    .maybeSingle();

  if (existing) {
    await supabase.from('account_balances').update({
      amount: existing.amount + amount,
      balance_datetime: now,
    }).eq('id', existing.id);
  } else {
    await supabase.from('account_balances').insert({
      account_id: accountId,
      balance_type: 'ClosingAvailable',
      amount,
      currency,
      credit_debit_indicator: 'Credit',
      balance_datetime: now,
    });
  }

  // Record transaction
  await supabase.from('transactions').insert({
    account_id: accountId,
    amount,
    currency,
    credit_debit_indicator: 'Credit',
    status: 'Booked',
    booking_datetime: now,
    value_datetime: now,
    transaction_type: 'deposit',
    transaction_information: `Account funding via gateway - ${txRef}`,
    user_id: userId,
    metadata: {
      gateway_reference: txRef,
      source: 'gateway_fund_account',
    },
  }).then(() => {}).catch(() => {});
}
