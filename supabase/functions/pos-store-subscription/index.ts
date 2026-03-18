import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const url = new URL(req.url);

    // GET: List plans or check merchant subscription status
    if (req.method === 'GET') {
      const merchantId = url.searchParams.get('merchant_id');

      if (merchantId) {
        const { data: subscription } = await supabase.from('pos_store_subscriptions')
          .select('*, pos_subscription_plans(*)')
          .eq('merchant_id', merchantId)
          .eq('status', 'active')
          .gte('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .maybeSingle();

        return new Response(JSON.stringify({ subscription, is_active: !!subscription }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: plans, error } = await supabase.from('pos_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price');
      if (error) throw error;

      return new Response(JSON.stringify({ plans }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST: Subscribe to a plan (with wallet debit)
    if (req.method === 'POST') {
      const body = await req.json();
      const { merchant_id, plan_id, payment_method } = body;

      if (!merchant_id || !plan_id) {
        return new Response(JSON.stringify({ error: 'merchant_id and plan_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify merchant ownership
      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id, plan_tier').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) {
        return new Response(JSON.stringify({ error: 'not_authorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get plan
      const { data: plan } = await supabase.from('pos_subscription_plans')
        .select('*').eq('id', plan_id).eq('is_active', true).single();
      if (!plan) {
        return new Response(JSON.stringify({ error: 'plan_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check for existing active subscription
      const { data: existing } = await supabase.from('pos_store_subscriptions')
        .select('id')
        .eq('merchant_id', merchant_id)
        .eq('status', 'active')
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: 'already_subscribed', message: 'Active subscription exists' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const planCurrency = plan.currency || 'XAF';
      const planPrice = plan.price || 0;

      // Attempt wallet debit if price > 0
      if (planPrice > 0) {
        // Get merchant wallet balance
        const { data: wallet } = await supabase
          .from('gateway_merchant_wallets')
          .select('id, available_balance')
          .eq('merchant_id', merchant_id)
          .eq('currency', planCurrency)
          .maybeSingle();

        const availableBalance = wallet?.available_balance || 0;

        if (availableBalance < planPrice) {
          return new Response(JSON.stringify({
            error: 'insufficient_balance',
            message: `Insufficient wallet balance. You have ${availableBalance.toLocaleString()} ${planCurrency} but need ${planPrice.toLocaleString()} ${planCurrency}.`,
            available_balance: availableBalance,
            required_amount: planPrice,
            shortfall: planPrice - availableBalance,
            currency: planCurrency,
          }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Debit wallet atomically
        await supabase.rpc('update_merchant_wallet', {
          _merchant_id: merchant_id,
          _currency: planCurrency,
          _available_delta: -planPrice,
          _ledger_delta: -planPrice,
        });
      }

      // Create subscription
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

      const { data: subscription, error: subErr } = await supabase.from('pos_store_subscriptions').insert({
        merchant_id,
        plan_id,
        status: 'active',
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      }).select('*, pos_subscription_plans(*)').single();

      if (subErr) throw subErr;

      // Update merchant plan_tier if enterprise
      if (plan.tier === 'enterprise') {
        await supabase.from('gateway_merchants')
          .update({ plan_tier: 'enterprise' })
          .eq('id', merchant_id);
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        action_type: 'subscription_activated',
        entity_type: 'pos_store_subscription',
        entity_id: subscription.id,
        performed_by: user.id,
        details: {
          plan_name: plan.name,
          plan_tier: plan.tier,
          price: planPrice,
          currency: planCurrency,
          duration_days: plan.duration_days,
          payment_method: planPrice > 0 ? 'wallet_debit' : 'free',
        },
      });

      return new Response(JSON.stringify({ subscription }), {
        status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('pos-store-subscription error:', error);
    return new Response(JSON.stringify({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
