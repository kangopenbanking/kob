import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Store publishing subscription manager.
 * Supports: list plans, get status, subscribe (with one-time trial guard),
 * cancel (keep active until expiry), toggle auto-renew.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'unauthorized' }, 401);
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return json({ error: 'unauthorized' }, 401);

    const url = new URL(req.url);

    // GET — list plans or merchant status
    if (req.method === 'GET') {
      const merchantId = url.searchParams.get('merchant_id');

      if (merchantId) {
        // Verify ownership
        const { data: merchant } = await supabase.from('gateway_merchants')
          .select('id').eq('id', merchantId).eq('user_id', user.id).maybeSingle();
        if (!merchant) return json({ error: 'not_authorized' }, 403);

        const { data: subscription } = await supabase.from('pos_store_subscriptions')
          .select('*, pos_subscription_plans(*)')
          .eq('merchant_id', merchantId)
          .in('status', ['active', 'trialing', 'past_due'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: trialUsage } = await supabase.from('pos_merchant_trial_usage')
          .select('*').eq('merchant_id', merchantId).maybeSingle();

        const { data: events } = await supabase.from('pos_store_subscription_events')
          .select('*').eq('merchant_id', merchantId)
          .order('created_at', { ascending: false }).limit(20);

        return json({
          subscription,
          is_active: !!subscription && ['active', 'trialing'].includes(subscription.status),
          trial_used: !!trialUsage,
          events: events || [],
        });
      }

      const { data: plans, error } = await supabase.from('pos_subscription_plans')
        .select('*').eq('is_active', true).order('price');
      if (error) throw error;
      return json({ plans });
    }

    // POST — actions
    if (req.method === 'POST') {
      const body = await req.json();
      const { action = 'subscribe', merchant_id, plan_id, subscription_id, auto_renew } = body;

      if (!merchant_id) return json({ error: 'merchant_id required' }, 400);

      const { data: merchant } = await supabase.from('gateway_merchants')
        .select('id, plan_tier').eq('id', merchant_id).eq('user_id', user.id).single();
      if (!merchant) return json({ error: 'not_authorized' }, 403);

      // ACTION: cancel — keeps subscription active until expiry, sets auto_renew=false
      if (action === 'cancel') {
        if (!subscription_id) return json({ error: 'subscription_id required' }, 400);
        const { data: sub } = await supabase.from('pos_store_subscriptions')
          .select('*').eq('id', subscription_id).eq('merchant_id', merchant_id).single();
        if (!sub) return json({ error: 'subscription_not_found' }, 404);

        await supabase.from('pos_store_subscriptions').update({
          auto_renew: false,
          cancelled_at: new Date().toISOString(),
        }).eq('id', subscription_id);

        await supabase.rpc('log_subscription_event', {
          _subscription_id: subscription_id,
          _event_type: 'cancelled',
          _details: { reason: 'merchant_request' },
        });

        return json({ success: true, message: 'Auto-renewal cancelled. Subscription remains active until expiry.' });
      }

      // ACTION: toggle auto-renew
      if (action === 'toggle_auto_renew') {
        if (!subscription_id || typeof auto_renew !== 'boolean') {
          return json({ error: 'subscription_id and auto_renew required' }, 400);
        }
        await supabase.from('pos_store_subscriptions').update({
          auto_renew,
          cancelled_at: auto_renew ? null : new Date().toISOString(),
        }).eq('id', subscription_id).eq('merchant_id', merchant_id);

        await supabase.rpc('log_subscription_event', {
          _subscription_id: subscription_id,
          _event_type: 'auto_renew_toggled',
          _details: { auto_renew },
        });

        return json({ success: true, auto_renew });
      }

      // ACTION: subscribe (default)
      if (!plan_id) return json({ error: 'plan_id required' }, 400);

      const { data: plan } = await supabase.from('pos_subscription_plans')
        .select('*').eq('id', plan_id).eq('is_active', true).single();
      if (!plan) return json({ error: 'plan_not_found' }, 404);

      // Block if active/trialing/past_due sub already exists
      const { data: existing } = await supabase.from('pos_store_subscriptions')
        .select('id, status, expires_at').eq('merchant_id', merchant_id)
        .in('status', ['active', 'trialing', 'past_due'])
        .maybeSingle();
      if (existing) {
        return json({ error: 'already_subscribed', message: 'You already have an active subscription. Cancel it first or wait for expiry.' }, 409);
      }

      // Determine if merchant gets trial: plan offers trial AND merchant hasn't used one yet
      const { data: trialUsed } = await supabase.from('pos_merchant_trial_usage')
        .select('merchant_id').eq('merchant_id', merchant_id).maybeSingle();

      const offerTrial = (plan.trial_days || 0) > 0 && !trialUsed && plan.price > 0;
      const planCurrency = plan.currency || 'XAF';
      const planPrice = Number(plan.price) || 0;
      const startsAt = new Date();

      let trialEndsAt: Date | null = null;
      let expiresAt: Date;
      let initialStatus: string;
      let nextBillingAt: Date;

      if (offerTrial) {
        trialEndsAt = new Date(startsAt.getTime() + plan.trial_days * 86400000);
        expiresAt = new Date(trialEndsAt); // trial period == initial expiry; cron will convert
        initialStatus = 'trialing';
        nextBillingAt = trialEndsAt;
      } else {
        // Wallet debit required for paid plans
        if (planPrice > 0) {
          const { data: wallet } = await supabase.from('gateway_merchant_wallets')
            .select('id, available_balance').eq('merchant_id', merchant_id)
            .eq('currency', planCurrency).maybeSingle();
          const available = Number(wallet?.available_balance || 0);
          if (available < planPrice) {
            return json({
              error: 'insufficient_balance',
              message: `Insufficient wallet balance. You have ${available.toLocaleString()} ${planCurrency} but need ${planPrice.toLocaleString()} ${planCurrency}.`,
              available_balance: available, required_amount: planPrice, shortfall: planPrice - available, currency: planCurrency,
            }, 402);
          }
          await supabase.rpc('update_merchant_wallet', {
            _merchant_id: merchant_id, _currency: planCurrency,
            _available_delta: -planPrice, _ledger_delta: -planPrice,
          });
        }
        expiresAt = new Date(startsAt.getTime() + plan.duration_days * 86400000);
        initialStatus = 'active';
        nextBillingAt = expiresAt;
      }

      const { data: subscription, error: subErr } = await supabase.from('pos_store_subscriptions').insert({
        merchant_id, plan_id, status: initialStatus,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        trial_ends_at: trialEndsAt?.toISOString() || null,
        next_billing_attempt_at: nextBillingAt.toISOString(),
        auto_renew: plan.auto_renew_default !== false,
        payment_method: 'wallet',
      } as any).select('*, pos_subscription_plans(*)').single();
      if (subErr) throw subErr;

      // Update merchant tier
      if (plan.tier === 'enterprise') {
        await supabase.from('gateway_merchants').update({ plan_tier: 'enterprise' }).eq('id', merchant_id);
      }

      // Log subscription_created (trial_started fires via DB trigger automatically)
      if (!offerTrial && planPrice > 0) {
        await supabase.rpc('log_subscription_event', {
          _subscription_id: subscription.id, _event_type: 'subscription_created',
          _amount: planPrice, _currency: planCurrency,
          _details: { payment_method: 'wallet_debit' },
        });
      }

      // Send welcome email (best-effort)
      try {
        await supabase.functions.invoke('send-managed-email', {
          body: {
            email_key: offerTrial ? 'merchant_trial_started' : 'merchant_subscription_created',
            recipient_user_id: user.id,
            variables: {
              plan_name: plan.name,
              trial_days: String(plan.trial_days || 0),
              expires_at: expiresAt.toLocaleDateString('en-US', { dateStyle: 'long' }),
              amount: planPrice.toLocaleString(),
              currency: planCurrency,
            },
          },
        }).catch(() => {});
      } catch { /* non-fatal */ }

      // Audit log
      await supabase.from('audit_logs').insert({
        action_type: offerTrial ? 'subscription_trial_started' : 'subscription_activated',
        entity_type: 'pos_store_subscription',
        entity_id: subscription.id,
        performed_by: user.id,
        details: {
          plan_name: plan.name, plan_tier: plan.tier, price: planPrice,
          currency: planCurrency, trial_days: offerTrial ? plan.trial_days : 0,
          payment_method: offerTrial ? 'trial' : (planPrice > 0 ? 'wallet_debit' : 'free'),
        },
      });

      return json({ subscription, is_trial: offerTrial }, 201);
    }

    return json({ error: 'method_not_allowed' }, 405);
  } catch (error) {
    console.error('pos-store-subscription error:', error);
    return json({ error: 'internal_error', message: error instanceof Error ? error.message : 'Unknown' }, 500);
  }
});
