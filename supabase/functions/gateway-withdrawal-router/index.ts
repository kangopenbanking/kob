// deno-lint-ignore-file
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyCronAuth } from "../_shared/cron-auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmins, notifyUser } from "../_shared/admin-notify.ts";
import { sendManagedEmail } from "../_shared/send-managed-email.ts";

const jsonRes = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const rfc7807 = (type: string, title: string, status: number, detail: string) =>
  new Response(JSON.stringify({ type: `${Deno.env.get("SUPABASE_URL")!}/functions/v1/errors/${type}`, title, status, detail }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Try to parse body (may be cron call with no body)
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body OK for cron */ }
    const action = body.action || new URL(req.url).searchParams.get('action');

    // ─── CRON: auto_withdrawal_execute ───
    if (action === 'cron_execute') {
      const auth = verifyCronAuth(req);
      if (!auth.authorized) return auth.response!;
      return handleAutoWithdrawalCron(supabase);
    }

    // All other actions require user auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return rfc7807('unauthorized', 'Unauthorized', 401, 'Missing Authorization header');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !user) return rfc7807('unauthorized', 'Unauthorized', 401, 'Invalid or expired token');

    switch (action) {
      case 'list_rules': return handleListRules(req, supabase, user, body);
      case 'create_rule': return handleCreateRule(supabase, user, body);
      case 'update_rule': return handleUpdateRule(supabase, user, body);
      case 'delete_rule': return handleDeleteRule(req, supabase, user, body);
      case 'admin_reverse': return handleAdminReverse(supabase, user, body);
      default: return rfc7807('invalid_action', 'Invalid Action', 400, `Unknown action: ${action}. Valid: list_rules, create_rule, update_rule, delete_rule, admin_reverse, cron_execute`);
    }
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] gateway-withdrawal-router error:`, err);
    return rfc7807('internal_error', 'Internal Server Error', 500, `Reference: ${errorId}`);
  }
});

// ─── List rules (was GET gateway-auto-withdrawal-rules) ───
async function handleListRules(req: Request, supabase: any, user: any, body: any) {
  const url = new URL(req.url);
  const ownerType = body.owner_type || url.searchParams.get('owner_type') || 'consumer';
  const ownerId = body.owner_id || url.searchParams.get('owner_id') || user.id;
  const { data, error } = await supabase.from('payout_schedules').select('*').eq('owner_type', ownerType).eq('owner_id', ownerId).order('created_at', { ascending: false });
  if (error) throw error;
  return jsonRes({ data });
}

// ─── Create rule (was POST gateway-auto-withdrawal-rules) ───
async function handleCreateRule(supabase: any, user: any, body: any) {
  const { owner_type = 'consumer', owner_id, destination_id, destination_type, schedule_type, schedule_config = {}, amount_mode = 'sweep_all', amount_value = 0, min_balance_to_keep = 0, currency = 'XAF' } = body;
  const effectiveOwnerId = owner_id || user.id;

  if (owner_type === 'consumer') {
    const { data: linked } = await supabase.from('customer_linked_accounts').select('id').eq('id', destination_id).eq('user_id', effectiveOwnerId).eq('is_active', true).maybeSingle();
    if (!linked) return jsonRes({ error: 'destination_not_found', message: 'Linked account not found or inactive' }, 404);
  } else {
    const { data: settlement } = await supabase.from('gateway_merchant_settlement_accounts').select('id').eq('id', destination_id).eq('merchant_id', effectiveOwnerId).eq('is_active', true).maybeSingle();
    if (!settlement) return jsonRes({ error: 'destination_not_found', message: 'Settlement account not found' }, 404);
  }

  const { count } = await supabase.from('payout_schedules').select('id', { count: 'exact', head: true }).eq('owner_id', effectiveOwnerId).eq('is_enabled', true);
  if ((count || 0) >= 3) return jsonRes({ error: 'limit_reached', message: 'Maximum 3 active auto-withdrawal rules allowed' }, 400);

  const nextRunAt = computeNextRun(schedule_type, schedule_config);
  const { data, error } = await supabase.from('payout_schedules').insert({ owner_type, owner_id: effectiveOwnerId, destination_id, destination_type: destination_type || owner_type, schedule_type, schedule_config, amount_mode, amount_value, min_balance_to_keep, currency, next_run_at: nextRunAt }).select().single();
  if (error) throw error;

  await supabase.from('audit_logs').insert({ action_type: 'auto_withdrawal_rule_created', entity_type: 'payout_schedule', entity_id: data.id, performed_by: user.id, details: { schedule_type, amount_mode, amount_value } }).catch(() => {});
  return jsonRes({ data }, 201);
}

// ─── Update rule (was PUT gateway-auto-withdrawal-rules) ───
async function handleUpdateRule(supabase: any, user: any, body: any) {
  const { id, ...updates } = body;
  if (!id) return jsonRes({ error: 'id required' }, 400);
  const { data: existing } = await supabase.from('payout_schedules').select('owner_id').eq('id', id).single();
  if (!existing) return jsonRes({ error: 'not_found' }, 404);
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (existing.owner_id !== user.id && !isAdmin) return jsonRes({ error: 'forbidden' }, 403);
  if (updates.schedule_type || updates.schedule_config) updates.next_run_at = computeNextRun(updates.schedule_type || 'daily', updates.schedule_config || {});
  if (updates.is_enabled === true) updates.consecutive_failures = 0;
  delete updates.action;
  const { data, error } = await supabase.from('payout_schedules').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return jsonRes({ data });
}

// ─── Delete rule (was DELETE gateway-auto-withdrawal-rules) ───
async function handleDeleteRule(req: Request, supabase: any, user: any, body: any) {
  const id = body.id || new URL(req.url).searchParams.get('id');
  if (!id) return jsonRes({ error: 'id required' }, 400);
  const { error } = await supabase.from('payout_schedules').update({ is_enabled: false }).eq('id', id);
  if (error) throw error;
  await supabase.from('audit_logs').insert({ action_type: 'auto_withdrawal_rule_disabled', entity_type: 'payout_schedule', entity_id: id, performed_by: user.id, details: {} }).catch(() => {});
  return jsonRes({ success: true });
}

// ─── Admin reverse withdrawal (was gateway-admin-reverse-withdrawal) ───
async function handleAdminReverse(supabase: any, user: any, body: any) {
  const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!adminRole) return rfc7807('forbidden', 'Forbidden', 403, 'Admin access required');

  const { payout_id, transaction_id, reason } = body;
  if (!payout_id && !transaction_id) return rfc7807('validation_error', 'Validation Error', 400, 'Either payout_id or transaction_id is required');

  if (payout_id) {
    const { data: payout, error: fetchErr } = await supabase.from('gateway_payouts').select('*').eq('id', payout_id).single();
    if (fetchErr || !payout) return rfc7807('not_found', 'Payout Not Found', 404, 'Payout does not exist');
    if (!['pending', 'processing', 'completed'].includes(payout.status)) return rfc7807('payout_not_reversible', 'Payout Not Reversible', 409, `Payout is in '${payout.status}' state`);
    if (payout.status === 'reversed') return rfc7807('already_reversed', 'Already Reversed', 409, 'This payout has already been reversed');

    const isConsumerPayout = payout.metadata?.withdrawal === true || !payout.merchant_id;
    const isMerchantPayout = !!payout.merchant_id;
    const totalDebit = payout.amount + (payout.fee_amount || 0);
    let balanceRestored = false;

    if (isConsumerPayout && payout.metadata?.account_id) {
      const { data: balanceRecord } = await supabase.from('account_balances').select('id, amount').eq('account_id', payout.metadata.account_id).in('balance_type', ['ClosingAvailable', 'InterimAvailable']).order('balance_datetime', { ascending: false }).limit(1).maybeSingle();
      if (balanceRecord) { await supabase.from('account_balances').update({ amount: balanceRecord.amount + totalDebit, balance_datetime: new Date().toISOString() }).eq('id', balanceRecord.id); balanceRestored = true; }
    }
    if (isMerchantPayout) { await supabase.rpc('update_merchant_wallet', { _merchant_id: payout.merchant_id, _currency: payout.currency, _available_delta: payout.amount, _ledger_delta: payout.amount }); balanceRestored = true; }

    await supabase.from('gateway_payouts').update({ status: 'reversed', failure_reason: reason || 'Reversed by admin', updated_at: new Date().toISOString() }).eq('id', payout_id);

    if (payout.tx_ref) {
      await supabase.from('transactions').update({ status: 'reversed', transaction_information: `REVERSED by admin — ${reason || 'Admin reversal'}` }).eq('metadata->>tx_ref', payout.tx_ref).eq('transaction_type', 'withdrawal');
      const payoutUserId = payout.metadata?.user_id;
      if (payoutUserId && payout.metadata?.account_id) {
        await supabase.from('transactions').insert({ user_id: payoutUserId, account_id: payout.metadata.account_id, transaction_type: 'reversal', amount: totalDebit, currency: payout.currency, status: 'completed', credit_debit_indicator: 'Credit', transaction_information: `Reversal of payout ${payout_id} — ${reason || 'Admin reversal'}`, booking_datetime: new Date().toISOString(), value_datetime: new Date().toISOString(), metadata: { original_payout_id: payout_id, original_tx_ref: payout.tx_ref, reversed_by: user.id, reason } });
      }
    }

    const fmtAmt = new Intl.NumberFormat('fr-CM').format(payout.amount);
    await supabase.from('audit_logs').insert({ action_type: 'payout_reversed', entity_type: 'gateway_payout', entity_id: payout_id, performed_by: user.id, details: { reason, amount: payout.amount, fee_amount: payout.fee_amount, total_restored: totalDebit, currency: payout.currency, provider: payout.provider, channel: payout.channel, tx_ref: payout.tx_ref, was_consumer_withdrawal: isConsumerPayout, was_merchant_payout: isMerchantPayout, balance_restored: balanceRestored, original_status: payout.status } });

    const payoutUserId = payout.metadata?.user_id;
    notifyAdmins(supabase, { event_type: 'payout_reversed', entity_type: 'gateway_payout', entity_id: payout_id, title: 'Payout Reversed by Admin', message: `${payout.currency} ${fmtAmt} payout reversed. Reason: ${reason || 'Admin action'}. Ref: ${payout.tx_ref}`, metadata: { payout_id, amount: payout.amount, reversed_by: user.id, reason } });
    if (payoutUserId) {
      notifyUser(supabase, { user_id: payoutUserId, type: 'success', title: 'Withdrawal Reversed — Funds Restored', message: `${payout.currency} ${fmtAmt} has been credited back to your account.`, icon: 'cash_out', metadata: { payout_id, amount: payout.amount } });
      sendManagedEmail(supabase, { email_key: 'withdrawal_reversal_notification', recipient_user_id: payoutUserId, variables: { currency: payout.currency, amount: fmtAmt, reason: reason || 'Provider failed to deliver funds', tx_ref: payout.tx_ref || payout_id } });
    }

    return jsonRes({ success: true, payout_id, status: 'reversed', reversed_amount: payout.amount, fee_restored: payout.fee_amount || 0, total_restored: totalDebit, balance_restored: balanceRestored, reversed_by: user.id, reason: reason || 'Reversed by admin', reversed_at: new Date().toISOString() });
  }

  // Legacy path: reverse by transaction_id
  const { data: tx, error: txError } = await supabase.from('transactions').select('*').eq('id', transaction_id).single();
  if (txError || !tx) return rfc7807('not_found', 'Not Found', 404, 'Transaction not found');
  if (tx.status === 'reversed') return rfc7807('already_reversed', 'Already Reversed', 409, 'Already reversed');
  if (tx.transaction_type !== 'withdrawal') return rfc7807('invalid_type', 'Invalid Type', 400, 'Only withdrawal transactions can be reversed');

  const reversalAmount = tx.amount;
  if (tx.account_id) {
    const { data: balanceRecord } = await supabase.from('account_balances').select('*').eq('account_id', tx.account_id).in('balance_type', ['ClosingAvailable', 'InterimAvailable']).order('balance_datetime', { ascending: false }).limit(1).single();
    if (balanceRecord) await supabase.from('account_balances').update({ amount: (balanceRecord.amount || 0) + reversalAmount, balance_datetime: new Date().toISOString() }).eq('id', balanceRecord.id);
  }
  await supabase.from('transactions').update({ status: 'reversed', transaction_information: `REVERSED by admin - ${reason || 'Provider failed to deliver funds'}` }).eq('id', transaction_id);
  const txMeta = tx.metadata as any;
  if (txMeta?.tx_ref) await supabase.from('gateway_payouts').update({ status: 'reversed' }).eq('tx_ref', txMeta.tx_ref);
  await supabase.from('transactions').insert({ user_id: tx.user_id, institution_id: tx.institution_id, account_id: tx.account_id, transaction_type: 'reversal', amount: reversalAmount, currency: tx.currency, status: 'completed', credit_debit_indicator: 'Credit', transaction_information: `Reversal of failed withdrawal ${transaction_id}`, booking_datetime: new Date().toISOString(), value_datetime: new Date().toISOString(), metadata: { original_transaction_id: transaction_id, reversed_by: user.id, reason } });

  const fmtAmt = new Intl.NumberFormat('fr-CM').format(reversalAmount);
  await supabase.from('audit_logs').insert({ action_type: 'admin_withdrawal_reversal', entity_type: 'transaction', entity_id: transaction_id, performed_by: user.id, details: { original_amount: reversalAmount, currency: tx.currency, account_id: tx.account_id, user_id: tx.user_id, reason } });
  notifyAdmins(supabase, { event_type: 'withdrawal_reversed', entity_type: 'transaction', entity_id: transaction_id, title: 'Withdrawal Reversed by Admin', message: `${tx.currency} ${fmtAmt} withdrawal reversed.`, metadata: { transaction_id, amount: reversalAmount, reversed_by: user.id, reason } });
  if (tx.user_id) {
    notifyUser(supabase, { user_id: tx.user_id, type: 'success', title: 'Withdrawal Reversed — Funds Restored', message: `${tx.currency} ${fmtAmt} has been credited back.`, icon: 'cash_out', metadata: { transaction_id, amount: reversalAmount } });
    sendManagedEmail(supabase, { email_key: 'withdrawal_reversal_notification', recipient_user_id: tx.user_id, variables: { currency: tx.currency, amount: fmtAmt, reason: reason || 'Provider failed to deliver funds', tx_ref: txMeta?.tx_ref || transaction_id } });
  }
  return jsonRes({ success: true, transaction_id, reversed_amount: reversalAmount, balance_restored: true, reversed_by: user.id });
}

// ─── Auto-withdrawal cron (was gateway-auto-withdrawal-cron) ───
async function handleAutoWithdrawalCron(supabase: any) {
  const { data: dueSchedules, error } = await supabase.from('payout_schedules').select('*').eq('is_enabled', true).lte('next_run_at', new Date().toISOString()).order('next_run_at', { ascending: true }).limit(50);
  if (error) throw error;
  if (!dueSchedules?.length) return jsonRes({ processed: 0 });

  let processed = 0, failed = 0;
  for (const schedule of dueSchedules) {
    try {
      let withdrawalAmount = 0, availableBalance = 0;

      if (schedule.owner_type === 'consumer') {
        const { data: accounts } = await supabase.from('accounts').select('id').eq('user_id', schedule.owner_id).eq('is_active', true).limit(1);
        if (!accounts?.length) throw new Error('No active consumer account found');
        const accountId = accounts[0].id;
        const { data: balance } = await supabase.from('account_balances').select('amount').eq('account_id', accountId).eq('credit_debit_indicator', 'Credit').in('balance_type', ['ClosingAvailable', 'InterimAvailable']).order('balance_datetime', { ascending: false }).limit(1).maybeSingle();
        availableBalance = balance?.amount || 0;
        if (schedule.amount_mode === 'sweep_all') withdrawalAmount = Math.max(availableBalance - (schedule.min_balance_to_keep || 0), 0);
        else if (schedule.amount_mode === 'fixed') withdrawalAmount = schedule.amount_value || 0;
        else if (schedule.amount_mode === 'percentage') withdrawalAmount = Math.round(availableBalance * ((schedule.amount_value || 0) / 100));
        if (schedule.schedule_type === 'threshold') {
          const threshold = schedule.schedule_config?.threshold_amount || 0;
          if (availableBalance < threshold) { await supabase.from('payout_schedules').update({ next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() }).eq('id', schedule.id); continue; }
        }
        if (withdrawalAmount < 500) { await updateScheduleNextRun(supabase, schedule); continue; }
        const { data: linkedAccount } = await supabase.from('customer_linked_accounts').select('account_type').eq('id', schedule.destination_id).eq('is_active', true).maybeSingle();
        if (!linkedAccount) throw new Error('Destination account not found or inactive');
        const { data: result, error: wdErr } = await supabase.functions.invoke('gateway-process-withdrawal', { body: { amount: withdrawalAmount, account_id: accountId, destination_type: linkedAccount.account_type, linked_account_id: schedule.destination_id, currency: schedule.currency, narration: `Auto-withdrawal: ${schedule.schedule_type} rule` } });
        if (wdErr || result?.error) throw new Error(result?.message || wdErr?.message || 'Withdrawal failed');
      } else {
        const { data: wallet } = await supabase.from('gateway_merchant_wallets').select('available_balance').eq('merchant_id', schedule.owner_id).eq('currency', schedule.currency).maybeSingle();
        availableBalance = wallet?.available_balance || 0;
        if (schedule.amount_mode === 'sweep_all') withdrawalAmount = Math.max(availableBalance - (schedule.min_balance_to_keep || 0), 0);
        else if (schedule.amount_mode === 'fixed') withdrawalAmount = schedule.amount_value || 0;
        else if (schedule.amount_mode === 'percentage') withdrawalAmount = Math.round(availableBalance * ((schedule.amount_value || 0) / 100));
        if (schedule.schedule_type === 'threshold') {
          if (availableBalance < (schedule.schedule_config?.threshold_amount || 0)) { await supabase.from('payout_schedules').update({ next_run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() }).eq('id', schedule.id); continue; }
        }
        if (withdrawalAmount < 1000) { await updateScheduleNextRun(supabase, schedule); continue; }
        const tx_ref = `AUTO_${schedule.schedule_type.toUpperCase()}_${Date.now()}`;
        const { error: payoutErr } = await supabase.from('gateway_payouts').insert({ merchant_id: schedule.owner_id, amount: withdrawalAmount, currency: schedule.currency, channel: 'bank_transfer', status: 'pending', provider: 'flutterwave', beneficiary_name: 'Auto-withdrawal', tx_ref, metadata: { auto_withdrawal: true, schedule_id: schedule.id, schedule_type: schedule.schedule_type } });
        if (payoutErr) throw payoutErr;
      }
      await supabase.from('payout_schedules').update({ last_run_at: new Date().toISOString(), consecutive_failures: 0 }).eq('id', schedule.id);
      await updateScheduleNextRun(supabase, schedule);
      await supabase.from('audit_logs').insert({ action_type: 'auto_withdrawal_executed', entity_type: 'payout_schedule', entity_id: schedule.id, performed_by: schedule.owner_id, details: { amount: withdrawalAmount, schedule_type: schedule.schedule_type } }).catch(() => {});
      processed++;
    } catch (scheduleErr: any) {
      console.error(`[Auto-Withdrawal Cron] Schedule ${schedule.id} failed:`, scheduleErr);
      const newFailures = (schedule.consecutive_failures || 0) + 1;
      const autoDisable = newFailures >= 3;
      await supabase.from('payout_schedules').update({ consecutive_failures: newFailures, is_enabled: !autoDisable, last_run_at: new Date().toISOString() }).eq('id', schedule.id);
      if (!autoDisable) await updateScheduleNextRun(supabase, schedule);
      await supabase.from('app_notifications').insert({ user_id: schedule.owner_id, type: autoDisable ? 'warning' : 'info', title: autoDisable ? 'Auto-Withdrawal Disabled' : 'Auto-Withdrawal Failed', message: autoDisable ? `Your ${schedule.schedule_type} auto-withdrawal rule has been disabled after 3 consecutive failures.` : `Your ${schedule.schedule_type} auto-withdrawal failed: ${scheduleErr.message}`, icon: 'cash_out', metadata: { schedule_id: schedule.id, error: scheduleErr.message } }).catch(() => {});
      failed++;
    }
  }
  return jsonRes({ processed, failed, total: dueSchedules.length });
}

function computeNextRun(scheduleType: string, config: any): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(config.hour ?? 18, config.minute ?? 0, 0, 0);
  switch (scheduleType) {
    case 'daily': if (next <= now) next.setDate(next.getDate() + 1); break;
    case 'weekly': { const d = (config.day_of_week ?? 5) - next.getDay(); next.setDate(next.getDate() + ((d + 7) % 7 || 7)); if (next <= now) next.setDate(next.getDate() + 7); break; }
    case 'monthly': { next.setDate(config.day_of_month ?? 1); if (next <= now) next.setMonth(next.getMonth() + 1); break; }
    case 'threshold': next.setTime(now.getTime() + 5 * 60 * 1000); break;
  }
  return next.toISOString();
}

async function updateScheduleNextRun(supabase: any, schedule: any) {
  const nextRun = computeNextRun(schedule.schedule_type, schedule.schedule_config || {});
  await supabase.from('payout_schedules').update({ next_run_at: nextRun }).eq('id', schedule.id);
}
