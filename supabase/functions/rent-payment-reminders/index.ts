// Rent Payment Reminders — Cron Dispatcher
// ─────────────────────────────────────────────────────────────────
// Runs daily. For every active rent plan, finds the next pending payment
// and notifies the user when:
//   - 3 days before the due date  (early warning)
//   - 1 day before the due date   (final warning)
//   - on the due date             (final reminder)
//   - 1, 3, and 7 days overdue    (overdue alerts, before missed cron fires)
//
// Sends an in-app notification AND a transactional email
// (gated by crediq_email_preferences.score_change_alerts as a proxy
// for "wants rent activity emails", since rent affects credit score).
// Dedupes via the existing crediq_reminder_log table.
// ─────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

const APP_URL = 'https://kob.lovable.app';
const REMINDER_OFFSETS = [3, 1, 0, -1, -3, -7]; // days_until_due (negative = overdue)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Allow cron + service-role invocation
  const auth = verifyCronAuth(req);
  if (!auth.authorized) return auth.response!;

  try {
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const onlyUserId = body.user_id as string | undefined;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);

    // Build target due-date list (today ± offsets)
    const targetDates = REMINDER_OFFSETS.map((o) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() + o);
      return { date: d.toISOString().slice(0, 10), days_until_due: o };
    });

    let candidatesScanned = 0;
    let inAppSent = 0;
    let emailSent = 0;
    let skippedAlreadySent = 0;
    let skippedOptOut = 0;

    for (const target of targetDates) {
      let q = service
        .from('piggybank_payments')
        .select('id, plan_id, user_id, amount, due_date, status, piggybank_plans!inner(plan_name, plan_type, rent_reference, status, user_id)')
        .eq('status', 'pending')
        .eq('due_date', target.date)
        .eq('piggybank_plans.plan_type', 'rent')
        .eq('piggybank_plans.status', 'active');

      if (onlyUserId) q = q.eq('user_id', onlyUserId);

      const { data: payments, error } = await q;
      if (error) {
        console.error('rent-reminders query error:', error);
        continue;
      }

      for (const payment of payments || []) {
        candidatesScanned++;
        const plan = (payment as any).piggybank_plans;
        const userId = payment.user_id;
        const isOverdue = target.days_until_due < 0;
        const offsetLabel = isOverdue ? `od${Math.abs(target.days_until_due)}` : `d${target.days_until_due}`;
        const periodKey = `${payment.id}-${offsetLabel}-${todayKey}`;

        // Dedupe via crediq_reminder_log (unique violation = already sent)
        const { error: dedupeErr } = await service.from('crediq_reminder_log').insert({
          user_id: userId,
          reminder_type: 'rent_payment',
          period_key: periodKey,
        });
        if (dedupeErr) { skippedAlreadySent++; continue; }

        const dueDateFormatted = new Date(payment.due_date + 'T00:00:00Z').toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
        });
        const title = isOverdue
          ? `Rent payment overdue (${plan.plan_name})`
          : target.days_until_due === 0
            ? `Rent payment due today (${plan.plan_name})`
            : `Rent payment due in ${target.days_until_due} day${target.days_until_due === 1 ? '' : 's'}`;
        const message = isOverdue
          ? `Your rent payment of ${Number(payment.amount).toLocaleString()} XAF for "${plan.plan_name}" was due on ${dueDateFormatted}. Record it now to limit credit damage.`
          : `Heads up — ${Number(payment.amount).toLocaleString()} XAF rent for "${plan.plan_name}" is due ${dueDateFormatted}. Record on time to earn +5–10 CrediQ points.`;

        // In-app notification (always sent — high signal)
        await service.from('app_notifications').insert({
          user_id: userId,
          type: isOverdue ? 'warning' : 'info',
          title,
          message,
          icon: 'home',
          metadata: {
            payment_id: payment.id,
            plan_id: payment.plan_id,
            rent_reference: plan.rent_reference,
            due_date: payment.due_date,
            amount: payment.amount,
            days_until_due: target.days_until_due,
          },
        });
        inAppSent++;

        // Email — gated by user preference
        const { data: prefs } = await service
          .from('crediq_email_preferences')
          .select('score_change_alerts')
          .eq('user_id', userId)
          .maybeSingle();
        if (prefs && prefs.score_change_alerts === false) { skippedOptOut++; continue; }

        const { data: profile } = await service
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .maybeSingle();
        const email = profile?.email;
        if (!email) continue;
        const name = profile?.full_name || email.split('@')[0];

        try {
          await service.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'rent-payment-reminder',
              recipientEmail: email,
              idempotencyKey: `rent-reminder-${payment.id}-${offsetLabel}`,
              templateData: {
                name,
                plan_name: plan.plan_name,
                rent_reference: plan.rent_reference,
                amount: Number(payment.amount),
                currency: 'XAF',
                due_date: dueDateFormatted,
                days_until_due: target.days_until_due,
                is_overdue: isOverdue,
                cta_url: `${APP_URL}/app/rent-reporting`,
              },
            },
          });
          emailSent++;
        } catch (e) {
          console.warn('rent-reminder email send failed:', e);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      scanned: candidatesScanned,
      in_app_sent: inAppSent,
      email_sent: emailSent,
      skipped_already_sent: skippedAlreadySent,
      skipped_opt_out: skippedOptOut,
      run_at: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] rent-payment-reminders error:`, err);
    return new Response(
      JSON.stringify({ error: 'An internal error occurred.', error_id: errorId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
