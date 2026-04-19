import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyCronAuth } from '../_shared/cron-auth.ts';

/**
 * Hourly cron: handles trial conversions + auto-renewals + retries.
 *
 * Logic:
 * 1. Trial ending (trialing + trial_ends_at <= now): try wallet debit for plan price.
 *    Success → status=active, expires_at extended by duration_days. Fail → unpublish + status=expired.
 * 2. Auto-renew (active + auto_renew=true + next_billing_attempt_at <= now): try wallet debit.
 *    Success → expires_at extended. Fail → status=past_due, retry tomorrow.
 * 3. Past-due retry: try debit again. After 3 attempts → status=expired + unpublish.
 * 4. Cancelled or auto_renew=false: let expire naturally → status=expired + unpublish.
 */
const MAX_RETRIES = 3;
const RETRY_INTERVAL_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const now = new Date();
  const results = { trial_converted: 0, trial_failed: 0, renewed: 0, renewal_failed: 0, expired: 0, errors: 0 };

  try {
    // Fetch all subscriptions due for action: trialing past trial_ends_at OR active/past_due past next_billing_attempt_at
    const { data: dueSubs, error: fetchErr } = await supabase
      .from('pos_store_subscriptions')
      .select('*, pos_subscription_plans(*)')
      .or('status.eq.trialing,status.eq.active,status.eq.past_due')
      .or(`trial_ends_at.lte.${now.toISOString()},next_billing_attempt_at.lte.${now.toISOString()}`);

    if (fetchErr) throw fetchErr;
    if (!dueSubs || dueSubs.length === 0) {
      return new Response(JSON.stringify({ message: 'no due subscriptions', results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const sub of dueSubs) {
      try {
        const plan = sub.pos_subscription_plans;
        if (!plan) continue;
        const price = Number(plan.price) || 0;
        const currency = plan.currency || 'XAF';

        const isTrialEnd = sub.status === 'trialing' && sub.trial_ends_at && new Date(sub.trial_ends_at) <= now;
        const isRenewal = (sub.status === 'active' || sub.status === 'past_due') &&
                          sub.next_billing_attempt_at && new Date(sub.next_billing_attempt_at) <= now;

        if (!isTrialEnd && !isRenewal) continue;

        // If auto_renew is OFF and this is a renewal — expire naturally
        if (isRenewal && !sub.auto_renew) {
          await expireSubscription(supabase, sub, 'auto_renew_disabled');
          results.expired++;
          continue;
        }

        // Get merchant user_id for emails
        const { data: merchantRow } = await supabase.from('gateway_merchants')
          .select('user_id').eq('id', sub.merchant_id).single();
        const userId = merchantRow?.user_id;

        // Get wallet balance
        const { data: wallet } = await supabase.from('gateway_merchant_wallets')
          .select('available_balance').eq('merchant_id', sub.merchant_id)
          .eq('currency', currency).maybeSingle();
        const available = Number(wallet?.available_balance || 0);

        if (available >= price) {
          // SUCCESS — debit and extend
          if (price > 0) {
            await supabase.rpc('update_merchant_wallet', {
              _merchant_id: sub.merchant_id, _currency: currency,
              _available_delta: -price, _ledger_delta: -price,
            });
          }
          const newExpiresAt = new Date(now.getTime() + plan.duration_days * 86400000);
          await supabase.from('pos_store_subscriptions').update({
            status: 'active',
            expires_at: newExpiresAt.toISOString(),
            trial_ends_at: null,
            next_billing_attempt_at: newExpiresAt.toISOString(),
            renewal_attempts: 0,
            last_renewal_error: null,
          } as any).eq('id', sub.id);

          if (isTrialEnd) {
            await supabase.from('pos_merchant_trial_usage').update({
              first_trial_ended_at: now.toISOString(), converted_to_paid: true,
            }).eq('merchant_id', sub.merchant_id);
            await supabase.rpc('log_subscription_event', {
              _subscription_id: sub.id, _event_type: 'trial_converted',
              _amount: price, _currency: currency,
              _details: { next_expires_at: newExpiresAt.toISOString() },
            });
            results.trial_converted++;
            await sendEmail(supabase, userId, 'merchant_trial_converted', { plan_name: plan.name, amount: price.toLocaleString(), currency, next_billing: newExpiresAt.toLocaleDateString('en-US', { dateStyle: 'long' }) });
          } else {
            await supabase.rpc('log_subscription_event', {
              _subscription_id: sub.id, _event_type: 'renewed',
              _amount: price, _currency: currency,
              _details: { next_expires_at: newExpiresAt.toISOString() },
            });
            results.renewed++;
            await sendEmail(supabase, userId, 'merchant_subscription_renewed', { plan_name: plan.name, amount: price.toLocaleString(), currency, next_billing: newExpiresAt.toLocaleDateString('en-US', { dateStyle: 'long' }) });
          }
        } else {
          // INSUFFICIENT FUNDS — retry or expire
          const attempts = (sub.renewal_attempts || 0) + 1;
          const errMsg = `Insufficient balance: ${available} < ${price} ${currency}`;

          if (attempts >= MAX_RETRIES || isTrialEnd) {
            // Trial fail = immediate unpublish; renewal fail after 3 tries = unpublish
            await expireSubscription(supabase, sub, isTrialEnd ? 'trial_conversion_failed' : 'max_retries_exceeded');
            await supabase.rpc('log_subscription_event', {
              _subscription_id: sub.id,
              _event_type: isTrialEnd ? 'trial_failed' : 'expired',
              _amount: price, _currency: currency,
              _details: { available_balance: available, attempts, reason: errMsg },
            });
            if (isTrialEnd) {
              results.trial_failed++;
              await sendEmail(supabase, userId, 'merchant_trial_failed', { plan_name: plan.name, amount: price.toLocaleString(), currency, shortfall: (price - available).toLocaleString() });
            } else {
              results.expired++;
              await sendEmail(supabase, userId, 'merchant_subscription_past_due', { plan_name: plan.name, amount: price.toLocaleString(), currency, shortfall: (price - available).toLocaleString() });
            }
          } else {
            // Schedule retry
            const nextAttempt = new Date(now.getTime() + RETRY_INTERVAL_HOURS * 3600000);
            await supabase.from('pos_store_subscriptions').update({
              status: 'past_due',
              next_billing_attempt_at: nextAttempt.toISOString(),
              renewal_attempts: attempts,
              last_renewal_error: errMsg,
            } as any).eq('id', sub.id);
            await supabase.rpc('log_subscription_event', {
              _subscription_id: sub.id, _event_type: 'renewal_failed',
              _amount: price, _currency: currency,
              _details: { available_balance: available, attempts, retry_at: nextAttempt.toISOString() },
            });
            results.renewal_failed++;
            await sendEmail(supabase, userId, 'merchant_renewal_failed', {
              plan_name: plan.name, amount: price.toLocaleString(), currency,
              shortfall: (price - available).toLocaleString(),
              attempts: String(attempts), max_attempts: String(MAX_RETRIES),
              next_retry: nextAttempt.toLocaleDateString('en-US', { dateStyle: 'long' }),
            });
          }
        }
      } catch (err) {
        console.error(`renewal-cron sub ${sub.id} error:`, err);
        results.errors++;
      }
    }

    return new Response(JSON.stringify({ success: true, processed: dueSubs.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('renewal-cron fatal:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err instanceof Error ? err.message : 'unknown', results }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function expireSubscription(supabase: any, sub: any, reason: string) {
  await supabase.from('pos_store_subscriptions').update({
    status: 'expired',
    expires_at: new Date().toISOString(),
    last_renewal_error: reason,
  } as any).eq('id', sub.id);
  // Unpublish store
  await supabase.from('pos_store_profiles').update({ is_published: false } as any).eq('merchant_id', sub.merchant_id);
}

async function sendEmail(supabase: any, userId: string | undefined, emailKey: string, variables: Record<string, string>) {
  if (!userId) return;
  try {
    await supabase.functions.invoke('send-managed-email', {
      body: { email_key: emailKey, recipient_user_id: userId, variables },
    }).catch(() => {});
  } catch { /* non-fatal */ }
}
