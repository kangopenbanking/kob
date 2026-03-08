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
        // Get active subscription for merchant
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

      // List available plans
      const { data: plans, error } = await supabase.from('pos_subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price');
      if (error) throw error;

      return new Response(JSON.stringify({ plans }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST: Subscribe to a plan
    if (req.method === 'POST') {
      const body = await req.json();
      const { merchant_id, plan_id } = body;

      if (!merchant_id || !plan_id) {
        return new Response(JSON.stringify({ error: 'merchant_id and plan_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Verify merchant ownership
      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id').eq('id', merchant_id).eq('user_id', user.id).single();
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
