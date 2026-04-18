import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Auto-Withdrawal Cron Executor
 * Runs every 5 minutes via pg_cron.
 * Queries due payout_schedules and triggers withdrawals.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const { authorized, response } = verifyCronAuth(req);
  if (!authorized) return response!;

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    // Get all due schedules
    const { data: dueSchedules, error } = await supabase
      .from('payout_schedules')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!dueSchedules || dueSchedules.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[Auto-Withdrawal Cron] ${dueSchedules.length} due schedule(s)`);

    let processed = 0;
    let failed = 0;

    for (const schedule of dueSchedules) {
      try {
        let withdrawalAmount = 0;
        let availableBalance = 0;

        if (schedule.owner_type === 'consumer') {
          // Get consumer account balance
          const { data: accounts } = await supabase
            .from('accounts')
            .select('id')
            .eq('user_id', schedule.owner_id)
            .eq('is_active', true)
            .limit(1);

          if (!accounts || accounts.length === 0) {
            throw new Error('No active consumer account found');
          }

          const accountId = accounts[0].id;

          const { data: balance } = await supabase
            .from('account_balances')
            .select('amount')
            .eq('account_id', accountId)
            .eq('credit_debit_indicator', 'Credit')
            .in('balance_type', ['ClosingAvailable', 'InterimAvailable'])
            .order('balance_datetime', { ascending: false })
            .limit(1)
            .maybeSingle();

          availableBalance = balance?.amount || 0;

          // Compute withdrawal amount based on mode
          if (schedule.amount_mode === 'sweep_all') {
            withdrawalAmount = Math.max(availableBalance - (schedule.min_balance_to_keep || 0), 0);
          } else if (schedule.amount_mode === 'fixed') {
            withdrawalAmount = schedule.amount_value || 0;
          } else if (schedule.amount_mode === 'percentage') {
            withdrawalAmount = Math.round(availableBalance * ((schedule.amount_value || 0) / 100));
          }

          // For threshold rules, only trigger if balance >= threshold
          if (schedule.schedule_type === 'threshold') {
            const threshold = schedule.schedule_config?.threshold_amount || 0;
            if (availableBalance < threshold) {
              // Not yet at threshold, reschedule check
              await supabase.from('payout_schedules').update({
                next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              }).eq('id', schedule.id);
              continue;
            }
          }

          if (withdrawalAmount < 500) {
            // Below minimum, skip
            await updateScheduleNextRun(supabase, schedule);
            continue;
          }

          // Get linked account for destination
          const { data: linkedAccount } = await supabase
            .from('customer_linked_accounts')
            .select('account_type')
            .eq('id', schedule.destination_id)
            .eq('is_active', true)
            .maybeSingle();

          if (!linkedAccount) throw new Error('Destination account not found or inactive');

          // F43 — Invoke withdrawal with internal-secret + on-behalf-of header
          const internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') || '';
          const idemKey = `auto_wd_${schedule.id}_${Math.floor(Date.now() / 60000)}`;
          const { data: result, error: wdErr } = await supabase.functions.invoke('gateway-process-withdrawal', {
            body: {
              amount: withdrawalAmount,
              account_id: accountId,
              destination_type: linkedAccount.account_type,
              linked_account_id: schedule.destination_id,
              currency: schedule.currency,
              narration: `Auto-withdrawal: ${schedule.schedule_type} rule`,
              idempotency_key: idemKey,
            },
            headers: {
              'x-internal-secret': internalSecret,
              'x-on-behalf-of': schedule.owner_id,
              'idempotency-key': idemKey,
            },
          });

          if (wdErr || result?.error) {
            throw new Error(result?.message || wdErr?.message || 'Withdrawal failed');
          }

        } else {
          // Merchant auto-withdrawal
          const { data: wallet } = await supabase
            .from('gateway_merchant_wallets')
            .select('available_balance')
            .eq('merchant_id', schedule.owner_id)
            .eq('currency', schedule.currency)
            .maybeSingle();

          availableBalance = wallet?.available_balance || 0;

          if (schedule.amount_mode === 'sweep_all') {
            withdrawalAmount = Math.max(availableBalance - (schedule.min_balance_to_keep || 0), 0);
          } else if (schedule.amount_mode === 'fixed') {
            withdrawalAmount = schedule.amount_value || 0;
          } else if (schedule.amount_mode === 'percentage') {
            withdrawalAmount = Math.round(availableBalance * ((schedule.amount_value || 0) / 100));
          }

          if (schedule.schedule_type === 'threshold') {
            const threshold = schedule.schedule_config?.threshold_amount || 0;
            if (availableBalance < threshold) {
              await supabase.from('payout_schedules').update({
                next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              }).eq('id', schedule.id);
              continue;
            }
          }

          if (withdrawalAmount < 1000) {
            await updateScheduleNextRun(supabase, schedule);
            continue;
          }

          // Get merchant user_id for auth context
          const { data: merchant } = await supabase
            .from('gateway_merchants')
            .select('user_id')
            .eq('id', schedule.owner_id)
            .single();

          if (!merchant) throw new Error('Merchant not found');

          // For merchant payouts, we create the payout directly since PIN bypass for cron
          const tx_ref = `AUTO_${schedule.schedule_type.toUpperCase()}_${Date.now()}`;
          
          const { error: payoutErr } = await supabase.from('gateway_payouts').insert({
            merchant_id: schedule.owner_id,
            amount: withdrawalAmount,
            currency: schedule.currency,
            channel: 'bank_transfer',
            status: 'pending',
            provider: 'flutterwave',
            beneficiary_name: 'Auto-withdrawal',
            tx_ref,
            metadata: {
              auto_withdrawal: true,
              schedule_id: schedule.id,
              schedule_type: schedule.schedule_type,
            },
          });

          if (payoutErr) throw payoutErr;
        }

        // Success — reset failures, update schedule
        await supabase.from('payout_schedules').update({
          last_run_at: new Date().toISOString(),
          consecutive_failures: 0,
        }).eq('id', schedule.id);

        await updateScheduleNextRun(supabase, schedule);

        // Audit
        await supabase.from('audit_logs').insert({
          action_type: 'auto_withdrawal_executed',
          entity_type: 'payout_schedule',
          entity_id: schedule.id,
          performed_by: schedule.owner_id,
          details: { amount: withdrawalAmount, schedule_type: schedule.schedule_type },
        }).catch(() => {});

        processed++;

      } catch (scheduleErr: any) {
        console.error(`[Auto-Withdrawal Cron] Schedule ${schedule.id} failed:`, scheduleErr);
        
        const newFailures = (schedule.consecutive_failures || 0) + 1;
        const autoDisable = newFailures >= 3;

        await supabase.from('payout_schedules').update({
          consecutive_failures: newFailures,
          is_enabled: !autoDisable,
          last_run_at: new Date().toISOString(),
        }).eq('id', schedule.id);

        if (!autoDisable) {
          await updateScheduleNextRun(supabase, schedule);
        }

        // Notify owner of failure
        await supabase.from('app_notifications').insert({
          user_id: schedule.owner_id,
          type: autoDisable ? 'warning' : 'info',
          title: autoDisable ? 'Auto-Withdrawal Disabled' : 'Auto-Withdrawal Failed',
          message: autoDisable
            ? `Your ${schedule.schedule_type} auto-withdrawal rule has been disabled after 3 consecutive failures. Please check your settings.`
            : `Your ${schedule.schedule_type} auto-withdrawal failed: ${scheduleErr.message}. Will retry next cycle.`,
          icon: 'cash_out',
          metadata: { schedule_id: schedule.id, error: scheduleErr.message },
        }).catch(() => {});

        failed++;
      }
    }

    console.log(`[Auto-Withdrawal Cron] Done: ${processed} processed, ${failed} failed`);

    return new Response(JSON.stringify({ processed, failed, total: dueSchedules.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('[Auto-Withdrawal Cron] Fatal error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function updateScheduleNextRun(supabase: any, schedule: any) {
  const now = new Date();
  const config = schedule.schedule_config || {};
  const hour = config.hour ?? 18;
  const minute = config.minute ?? 0;

  const next = new Date(now);
  next.setUTCHours(hour, minute, 0, 0);

  switch (schedule.schedule_type) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly': {
      const dayOfWeek = config.day_of_week ?? 5;
      const diff = (dayOfWeek - next.getDay() + 7) % 7 || 7;
      next.setDate(next.getDate() + diff);
      break;
    }
    case 'monthly': {
      const dayOfMonth = config.day_of_month ?? 1;
      next.setMonth(next.getMonth() + 1);
      next.setDate(dayOfMonth);
      break;
    }
    case 'threshold':
      next.setTime(now.getTime() + 5 * 60 * 1000);
      break;
  }

  await supabase.from('payout_schedules').update({
    next_run_at: next.toISOString(),
  }).eq('id', schedule.id);
}
