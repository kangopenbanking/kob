import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createFlutterwaveCharge, createStripeCharge, calculateGatewayFee, getPayPalAccessToken } from "../_shared/gateway-adapters.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: authError } = await supabase.auth.getUser(token);
    if (authError || !claims?.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claims.user.id;

    const body = await req.json();
    const { amount, currency = 'XAF', method, provider, account_id, return_url, metadata = {} } = body;
    const customerPhone = body.customer?.phone;
    const customerEmail = body.customer?.email;
    const idempotencyKey = req.headers.get('idempotency-key') || body.idempotency_key;

    // Validate
    if (!amount || amount <= 0) return new Response(JSON.stringify({ error: 'invalid_amount' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!method || !['mobile_money', 'card', 'paypal', 'bank_transfer'].includes(method)) {
      return new Response(JSON.stringify({ error: 'invalid_method', message: 'Must be mobile_money, card, paypal, or bank_transfer' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!account_id) return new Response(JSON.stringify({ error: 'missing_account_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Verify account ownership
    const { data: account } = await supabase.from('accounts').select('id, user_id, institution_id').eq('id', account_id).eq('user_id', userId).single();
    if (!account) return new Response(JSON.stringify({ error: 'account_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Idempotency check
    if (idempotencyKey) {
      const { data: existing } = await supabase.from('funding_intents').select('*').eq('account_id', account_id).eq('idempotency_key', idempotencyKey).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify(existing), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Fee calculation
    const feeChannel = method === 'paypal' ? 'paypal' : method === 'card' ? 'card' : method === 'bank_transfer' ? 'bank_transfer' : 'account_funding';
    const { fee, net } = calculateGatewayFee(amount, feeChannel);

    const txRef = `fi_${account_id.slice(0, 8)}_${Date.now()}`;
    let providerRef = '';
    let nextAction: Record<string, unknown> | null = null;
    let status = 'pending_provider';

    const resolvedProvider = provider || (method === 'mobile_money' ? 'flutterwave' : method === 'card' ? 'stripe' : method === 'paypal' ? 'paypal' : 'bank');

    // Route by provider
    if (resolvedProvider === 'flutterwave') {
      const result = await createFlutterwaveCharge({
        amount, currency, channel: method, customer_phone: customerPhone,
        customer_email: customerEmail || 'customer@kob.cm', tx_ref: txRef,
        metadata: { ...metadata, funding_intent: true, account_id, user_id: userId, redirect_url: return_url },
      });
      providerRef = result.provider_ref;
      if (result.redirect_url) {
        nextAction = { type: 'redirect', redirect_url: result.redirect_url };
        status = 'pending_customer_action';
      }
    } else if (resolvedProvider === 'stripe') {
      const result = await createStripeCharge({
        amount, currency, channel: 'card', customer_email: customerEmail, tx_ref: txRef,
        metadata: { ...metadata, funding_intent: 'true', account_id, user_id: userId },
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
            description: `Fund KOB account ${account_id.slice(0, 8)}`,
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
      nextAction = {
        type: 'bank_transfer_instructions',
        bank_name: 'Afriland First Bank',
        account_number: '10005 00041 09200950141 92',
        account_name: 'Kang Open Banking SA',
        reference: bankRef,
        amount, currency,
        instructions: `Transfer exactly ${amount} ${currency} to the account above with reference: ${bankRef}. Funds will be credited within 24-48 hours after verification.`,
      };
      status = 'pending_verification';
    }

    // Insert intent
    const intentData = {
      account_id, user_id: userId, institution_id: account.institution_id,
      amount, currency, method, provider: resolvedProvider, status,
      reference: txRef, idempotency_key: idempotencyKey || null,
      provider_reference: providerRef, fee_amount: fee, net_amount: net,
      next_action: nextAction, return_url, metadata,
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };

    const { data: intent, error: insertErr } = await supabase.from('funding_intents').insert(intentData).select().single();
    if (insertErr) throw insertErr;

    // Record event
    await supabase.from('funding_events').insert({
      funding_intent_id: intent.id, event_type: 'created',
      payload: { method, provider: resolvedProvider, amount, currency },
    });

    return new Response(JSON.stringify(intent), { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('Create funding intent error:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
