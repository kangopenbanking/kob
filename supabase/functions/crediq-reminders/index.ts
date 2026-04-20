// CrediQ — Reminder Dispatcher
// ─────────────────────────────────────────────────────────────────
// Cron-triggered job that sends:
//   - weekly digest (Mondays)
//   - monthly score report (1st of month)
//   - score-change alerts (recent snapshots showing >10pt move)
//   - tip recommendations (highest-impact unfinished tip)
//
// Honors crediq_email_preferences toggles and dedupes via
// crediq_reminder_log so each user gets at most one of each kind
// per period.
// ─────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.1";
import { corsHeaders } from "../_shared/cors.ts";

const APP_URL = 'https://kangopenbanking.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const service = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const force = !!body.force;
    const onlyUserId = body.user_id as string | undefined;

    const now = new Date();
    const weekKey = isoWeekKey(now);
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const dow = now.getUTCDay(); // 0 = Sun, 1 = Mon
    const dom = now.getUTCDate();

    let users: Array<{ user_id: string; weekly_digest: boolean; monthly_report: boolean; score_change_alerts: boolean; tips_recommendations: boolean }> = [];

    if (onlyUserId) {
      const { data } = await service
        .from('crediq_email_preferences')
        .select('user_id, weekly_digest, monthly_report, score_change_alerts, tips_recommendations')
        .eq('user_id', onlyUserId);
      users = data || [];
    } else {
      const { data } = await service
        .from('crediq_email_preferences')
        .select('user_id, weekly_digest, monthly_report, score_change_alerts, tips_recommendations')
        .or('weekly_digest.eq.true,monthly_report.eq.true,score_change_alerts.eq.true,tips_recommendations.eq.true');
      users = data || [];
    }

    let weeklySent = 0, monthlySent = 0, alertSent = 0, tipSent = 0;

    for (const u of users) {
      // Lookup user email
      const { data: profile } = await service
        .from('profiles')
        .select('email, full_name')
        .eq('id', u.user_id)
        .maybeSingle();
      const email = profile?.email;
      if (!email) continue;
      const name = profile?.full_name || email.split('@')[0];

      // Premium gating for some reminders (monthly report + tip recs require Premium)
      const { data: premium } = await service.rpc('has_crediq_premium', { _user_id: u.user_id });
      const hasPremium = !!premium;

      // Latest score
      const { data: profileRow } = await service
        .from('credit_profiles')
        .select('current_score, score_band, last_computed_at')
        .eq('user_id', u.user_id)
        .maybeSingle();

      const score = profileRow?.current_score ?? null;
      const band = profileRow?.score_band ?? null;
      if (score == null) continue;

      // ── 1. Weekly digest (Mondays) ──
      if (u.weekly_digest && (force || dow === 1)) {
        if (await mark(service, u.user_id, 'weekly_digest', weekKey)) {
          await sendEmail(service, email, 'crediq-weekly-digest', {
            name, score, band,
            cta_url: `${APP_URL}/app/credit`,
          });
          weeklySent++;
        }
      }

      // ── 2. Monthly report (1st) ──
      if (u.monthly_report && (force || dom === 1)) {
        if (await mark(service, u.user_id, 'monthly_report', monthKey)) {
          await sendEmail(service, email, 'crediq-monthly-report', {
            name, score, band,
            premium: hasPremium,
            cta_url: hasPremium ? `${APP_URL}/app/credit/report` : `${APP_URL}/app/credit/upgrade`,
          });
          monthlySent++;
        }
      }

      // ── 3. Score change alert (any move >= 10 points in last 24h) ──
      if (u.score_change_alerts) {
        const since = new Date(now.getTime() - 86_400_000).toISOString();
        const { data: snaps } = await service
          .from('credit_score_snapshots')
          .select('score, computed_at')
          .eq('user_id', u.user_id)
          .gte('computed_at', since)
          .order('computed_at', { ascending: false })
          .limit(2);

        if (snaps && snaps.length === 2) {
          const delta = snaps[0].score - snaps[1].score;
          if (Math.abs(delta) >= 10) {
            const periodKey = `${snaps[0].computed_at.slice(0, 13)}-${delta > 0 ? 'up' : 'down'}`;
            if (await mark(service, u.user_id, 'score_change', periodKey)) {
              await sendEmail(service, email, 'crediq-score-change', {
                name, score, delta,
                direction: delta > 0 ? 'increased' : 'decreased',
                cta_url: `${APP_URL}/app/credit`,
              });
              alertSent++;
            }
          }
        }
      }

      // ── 4. Tip recommendation (Wednesdays, premium only) ──
      if (u.tips_recommendations && hasPremium && (force || dow === 3)) {
        const { data: tips } = await service
          .from('credit_score_tips')
          .select('id, tip_content, estimated_impact, priority')
          .eq('user_id', u.user_id)
          .eq('is_completed', false)
          .gt('expires_at', now.toISOString())
          .order('estimated_impact', { ascending: false })
          .limit(1);

        if (tips && tips.length > 0) {
          if (await mark(service, u.user_id, 'tip_recommendation', weekKey)) {
            await sendEmail(service, email, 'crediq-tip-recommendation', {
              name, tip: tips[0].tip_content,
              impact: tips[0].estimated_impact,
              cta_url: `${APP_URL}/app/credit/tips`,
            });
            tipSent++;
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed_users: users.length,
      weekly_digest_sent: weeklySent,
      monthly_report_sent: monthlySent,
      score_change_alerts_sent: alertSent,
      tip_recommendations_sent: tipSent,
      run_at: now.toISOString(),
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] crediq-reminders error:`, err);
    return new Response(JSON.stringify({ error: 'An internal error occurred.', error_id: errorId }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function mark(service: any, userId: string, type: string, periodKey: string): Promise<boolean> {
  const { error } = await service.from('crediq_reminder_log').insert({
    user_id: userId, reminder_type: type, period_key: periodKey,
  });
  // unique violation = already sent
  return !error;
}

async function sendEmail(service: any, to: string, templateName: string, data: Record<string, unknown>) {
  try {
    await service.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: to,
        idempotencyKey: `${templateName}-${to}-${Date.now()}`,
        templateData: data,
      },
    });
  } catch (err) {
    console.warn(`Email send failed for ${templateName} → ${to}:`, err);
  }
}

function isoWeekKey(d: Date): string {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((target.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
