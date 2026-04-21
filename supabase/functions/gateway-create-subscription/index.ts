import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import { resolveAuth } from "../_shared/auth-api-key.ts";

function calculateNextCharge(interval: string, intervalCount: number): string {
  const now = new Date();
  switch (interval) {
    case 'daily': now.setDate(now.getDate() + intervalCount); break;
    case 'weekly': now.setDate(now.getDate() + 7 * intervalCount); break;
    case 'monthly': now.setMonth(now.getMonth() + intervalCount); break;
    case 'yearly': now.setFullYear(now.getFullYear() + intervalCount); break;
  }
  return now.toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Auth — accepts sk_test_/sk_live_ API keys, sbx_ legacy, or Supabase JWT
    const __authResult = await resolveAuth(req, supabase);
    if (__authResult.response) return __authResult.response;
    const __auth = __authResult.auth!;
    const user = { id: __auth.user_id, email: __auth.email } as any;

    const body = await req.json();
    const { merchant_id, plan_id, customer_email, customer_phone, customer_name, metadata } = body;

    if (!merchant_id || !plan_id || !customer_email) {
      return new Response(JSON.stringify({ error: 'missing_fields', message: 'merchant_id, plan_id, customer_email are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: merchant } = await supabase.from('gateway_merchants').select('id').eq('id', merchant_id).eq('user_id', user.id).single();
    if (!merchant) return new Response(JSON.stringify({ error: 'merchant_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: plan } = await supabase.from('gateway_payment_plans').select('*').eq('id', plan_id).eq('merchant_id', merchant_id).eq('is_active', true).single();
    if (!plan) return new Response(JSON.stringify({ error: 'plan_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const next_charge_at = calculateNextCharge(plan.interval, plan.interval_count);

    const { data: subscription, error: insertErr } = await supabase.from('gateway_subscriptions').insert({
      merchant_id, plan_id, customer_email, customer_phone, customer_name,
      next_charge_at, metadata: metadata || {},
    }).select().single();

    if (insertErr) throw insertErr;

    // Webhook event: subscription.created (using gateway_webhook_events for merchant notification)
    if (subscription.merchant_id) {
      await supabase.from('gateway_webhook_events').insert({
        merchant_id: subscription.merchant_id,
        event_type: 'subscription.created',
        payload: { subscription_id: subscription.id, plan_id, customer_email },
        status: 'pending', next_retry_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});
    }

    // Audit
    await supabase.from('audit_logs').insert({
      action_type: 'gateway_subscription_created', entity_type: 'gateway_subscription', entity_id: subscription.id,
      performed_by: user.id, details: { merchant_id, plan_id, customer_email },
    }).then(() => {}).catch(() => {});

    return new Response(JSON.stringify(subscription), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] create-subscription error:`, err);
    return new Response(JSON.stringify({ error: 'internal_error', error_id: errorId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
