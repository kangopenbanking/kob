// Promise to Pay — settlement matcher
// Called by repayment success paths (pay-by-bank, loan-ops, payment-router-charge)
// and the daily cron sweep. Atomically marks promises kept/partial/broken
// and charges the bank-configured missed-payment fee when a promise breaks.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { notifyPtpEvent } from '../_shared/ptp-notify.ts';
import { dispatchPtpWebhook, type PtpWebhookEvent } from '../_shared/ptp-webhook.ts';
import { computeMissedFee } from '../_shared/ptp-fee.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function recordCreditEvent(admin: ReturnType<typeof createClient>, userId: string, eventType: string, meta: Record<string, unknown>) {
  // Idempotent on (user_id, event_type, metadata.promise_id) — protects sweep
  // and webhook-triggered re-runs from double-writing credit events.
  const promiseId = (meta as any)?.promise_id;
  if (promiseId) {
    const { data: existing } = await admin
      .from('credit_events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .filter('metadata->>promise_id', 'eq', String(promiseId))
      .limit(1)
      .maybeSingle();
    if (existing) return;
  }
  await admin.from('credit_events').insert({ user_id: userId, event_type: eventType, metadata: meta });
}

/**
 * Charge the bank-configured missed-payment fee for a broken promise.
 * Idempotent on promise_id (skips if missed_fee_charged_at is already set).
 * Non-fatal: errors are logged so the sweep / match path always completes.
 */
async function chargeMissedFee(
  admin: ReturnType<typeof createClient>,
  promise: any,
  source: 'sweep' | 'match',
) {
  try {
    if (promise?.missed_fee_charged_at) return null; // already charged

    const { data: loan } = await admin
      .from('loan_accounts')
      .select('id, user_id, loan_product_id, outstanding_balance, penalty_charges, loan_account_number')
      .eq('id', promise.loan_account_id)
      .maybeSingle();
    if (!loan) return null;

    const { data: product } = await admin
      .from('loan_products')
      .select('id, institution_id, ptp_missed_fee_enabled, ptp_missed_fee_type, ptp_missed_fee_value, ptp_missed_fee_cap, ptp_missed_fee_grace_days')
      .eq('id', (loan as any).loan_product_id)
      .maybeSingle();

    const missed = Math.max(0, Number(promise.promised_amount) - Number(promise.kept_amount ?? 0));
    const fee = computeMissedFee(product as any, missed);
    if (!fee.enabled || fee.amount <= 0) return null;

    const currency = promise.currency ?? 'XAF';
    const institutionId = (product as any)?.institution_id ?? null;
    const reference = `PTP-FEE-${String(promise.id).slice(0, 8).toUpperCase()}`;

    // Re-check on the live row to avoid a race between concurrent sweep workers
    const { data: claim, error: claimErr } = await admin
      .from('promise_to_pay')
      .update({
        missed_fee_amount: fee.amount,
        missed_fee_currency: currency,
        missed_fee_type: fee.type,
        missed_fee_charged_at: new Date().toISOString(),
        missed_fee_reference: reference,
      })
      .eq('id', promise.id)
      .is('missed_fee_charged_at', null)
      .select('id')
      .maybeSingle();
    if (claimErr || !claim) return null; // another worker won the race

    // Bump loan outstanding + penalty_charges
    await admin.from('loan_accounts').update({
      outstanding_balance: Math.round((Number((loan as any).outstanding_balance ?? 0) + fee.amount) * 100) / 100,
      penalty_charges: Math.round((Number((loan as any).penalty_charges ?? 0) + fee.amount) * 100) / 100,
    }).eq('id', (loan as any).id);

    // Record on transaction_fees ledger if institution is known
    if (institutionId) {
      await admin.from('transaction_fees').insert({
        transaction_type: 'ptp_missed_fee',
        transaction_ref: reference,
        transaction_amount: missed,
        transaction_currency: currency,
        institution_id: institutionId,
        fee_model: fee.type,
        calculated_fee: fee.amount,
        final_fee: fee.amount,
        fee_breakdown: { promise_id: promise.id, loan_account_id: promise.loan_account_id, source, type: fee.type, raw_amount: fee.raw_amount, capped: fee.capped },
        metadata: { promise_id: promise.id, user_id: promise.user_id, source },
      });
    }

    await admin.from('promise_to_pay_events').insert({
      promise_id: promise.id,
      event_type: 'fee_charged',
      amount: fee.amount,
      metadata: { type: fee.type, currency, reference, source, raw_amount: fee.raw_amount, capped: fee.capped },
    });

    await notifyPtpEvent(admin, 'fee_charged' as any, promise.id, promise.user_id,
      `A late-payment fee of ${fee.amount} ${currency} was applied to your loan because your Promise to Pay was not kept.`,
      { feeAmount: String(fee.amount), feeType: fee.type, currency, reference });

    await dispatchPtpWebhook(admin, 'ptp.fee_charged', {
      promise_id: promise.id,
      user_id: promise.user_id,
      loan_account_id: promise.loan_account_id,
      amount: fee.amount,
      currency,
      promised_date: promise.promised_date,
      status: 'broken',
      data: { fee_type: fee.type, missed_amount: missed, reference, source, capped: fee.capped, raw_amount: fee.raw_amount },
    });

    return { amount: fee.amount, type: fee.type, currency, reference };
  } catch (e) {
    console.error('[ptp-settle] chargeMissedFee failed:', (e as Error).message);
    return null;
  }
}



Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode ?? 'match';

  try {
    if (mode === 'match') {
      const { loan_account_id, amount, paid_at } = body ?? {};
      if (!loan_account_id || amount == null) return json({ error: 'loan_account_id, amount required' }, 400);
      const paidDate = paid_at ? new Date(paid_at) : new Date();

      const { data: open } = await admin
        .from('promise_to_pay')
        .select('*')
        .eq('loan_account_id', loan_account_id)
        .in('status', ['scheduled', 'partially_kept'])
        .order('promised_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!open) return json({ matched: false });

      const newKept = Number(open.kept_amount ?? 0) + Number(amount);
      const onTime = paidDate <= new Date(open.promised_date + 'T23:59:59Z');
      const isFull = newKept >= Number(open.promised_amount);

      const status = isFull && onTime ? 'kept' : (newKept > 0 && onTime ? 'partially_kept' : 'broken');
      const updates: Record<string, unknown> = { kept_amount: newKept, status };
      if (status === 'kept') updates.kept_at = new Date().toISOString();
      if (status === 'broken') updates.broken_at = new Date().toISOString();

      const { data: updated } = await admin.from('promise_to_pay').update(updates).eq('id', open.id).select('*').single();
      await admin.from('promise_to_pay_events').insert({
        promise_id: open.id, event_type: 'payment_matched', amount, metadata: { status, paid_at: paidDate.toISOString() },
      });
      if (status === 'kept' || status === 'partially_kept' || status === 'broken') {
        const evKey = status === 'partially_kept' ? 'partial' : status;
        await admin.from('promise_to_pay_events').insert({
          promise_id: open.id, event_type: evKey, amount: newKept,
        });
        await recordCreditEvent(admin, open.user_id, `ptp_${evKey}`, { promise_id: open.id, amount: newKept });
        const remaining = Math.max(0, Number(open.promised_amount) - newKept);
        await notifyPtpEvent(admin, evKey as any, open.id, open.user_id,
          evKey === 'kept' ? `You kept your Promise to Pay of ${open.promised_amount} ${open.currency}.` :
          evKey === 'partial' ? `Partial payment of ${amount} ${open.currency} received. ${remaining} remaining.` :
          `Promise to Pay of ${open.promised_amount} ${open.currency} was not kept.`,
          {
            amount: String(open.promised_amount), currency: open.currency,
            paidAmount: String(amount), remaining: String(remaining),
            promisedDate: open.promised_date, missedAmount: String(remaining),
          });
        await dispatchPtpWebhook(admin, `ptp.${evKey}` as PtpWebhookEvent, {
          promise_id: open.id, user_id: open.user_id, loan_account_id: open.loan_account_id,
          amount: newKept, currency: open.currency, promised_date: open.promised_date, status,
          data: { paid_amount: amount, remaining, paid_at: paidDate.toISOString() },
        });
        if (status === 'broken') {
          await chargeMissedFee(admin, updated ?? { ...open, ...updates }, 'match');
        }
      }
      return json({ matched: true, promise: updated });
    }

    if (mode === 'sweep') {
      // Daily cron: mark overdue scheduled/partial promises as broken
      const grace = body?.grace_days ?? 1;
      const cutoff = new Date(Date.now() - grace * 86400000).toISOString().slice(0, 10);
      const { data: overdue } = await admin
        .from('promise_to_pay')
        .select('*')
        .in('status', ['scheduled', 'partially_kept'])
        .lt('promised_date', cutoff);

      let broken = 0;
      let feesCharged = 0;
      for (const p of overdue ?? []) {
        await admin.from('promise_to_pay').update({ status: 'broken', broken_at: new Date().toISOString() }).eq('id', p.id);
        await admin.from('promise_to_pay_events').insert({ promise_id: p.id, event_type: 'broken' });
        const missed = Number(p.promised_amount) - Number(p.kept_amount ?? 0);
        await recordCreditEvent(admin, p.user_id, 'ptp_broken', { promise_id: p.id, missed_amount: missed, via: 'sweep' });
        await notifyPtpEvent(admin, 'swept', p.id, p.user_id,
          `Promise to Pay of ${p.promised_amount} ${p.currency} was not kept by ${p.promised_date}.`,
          { missedAmount: String(missed), currency: p.currency, promisedDate: p.promised_date });
        await dispatchPtpWebhook(admin, 'ptp.swept', {
          promise_id: p.id, user_id: p.user_id, loan_account_id: p.loan_account_id,
          amount: p.promised_amount, currency: p.currency, promised_date: p.promised_date, status: 'broken',
          data: { missed_amount: missed, via: 'sweep' },
        });
        const fee = await chargeMissedFee(admin, { ...p, status: 'broken' }, 'sweep');
        if (fee) feesCharged++;
        broken++;
      }
      return json({ swept: overdue?.length ?? 0, broken, fees_charged: feesCharged });
    }

    if (mode === 'remind') {
      // Daily cron: notify consumers about upcoming due dates and broken-but-unpaid promises.
      // Idempotent per (promise_id, ptp_event) via notifyPtpEvent's app_notifications dedup.
      const today = new Date();
      const isoOffset = (days: number) => {
        const d = new Date(today.getTime() + days * 86400000);
        return d.toISOString().slice(0, 10);
      };
      const offsets: Array<{ days: number; event: 'reminder_3d' | 'reminder_1d' | 'reminder_due' }> = [
        { days: 3, event: 'reminder_3d' },
        { days: 1, event: 'reminder_1d' },
        { days: 0, event: 'reminder_due' },
      ];

      let upcomingSent = 0;
      for (const { days, event } of offsets) {
        const targetDate = isoOffset(days);
        const { data: due } = await admin
          .from('promise_to_pay')
          .select('*')
          .in('status', ['scheduled', 'partially_kept'])
          .eq('promised_date', targetDate);
        for (const p of due ?? []) {
          const remaining = Math.max(0, Number(p.promised_amount) - Number(p.kept_amount ?? 0));
          const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
          await notifyPtpEvent(admin, event as any, p.id, p.user_id,
            `Your Promise to Pay of ${remaining} ${p.currency} is due ${when} (${p.promised_date}).`,
            { amount: String(remaining), currency: p.currency, promisedDate: p.promised_date, daysUntilDue: String(days) });
          upcomingSent++;
        }
      }

      // Broken follow-up: 3 days after broken, still unpaid, single reminder.
      const brokenCutoff = new Date(today.getTime() - 3 * 86400000).toISOString().slice(0, 10);
      const { data: brokenUnpaid } = await admin
        .from('promise_to_pay')
        .select('*')
        .eq('status', 'broken')
        .lte('broken_at', brokenCutoff + 'T23:59:59Z');
      let followups = 0;
      for (const p of brokenUnpaid ?? []) {
        const remaining = Math.max(0, Number(p.promised_amount) - Number(p.kept_amount ?? 0));
        if (remaining <= 0) continue;
        await notifyPtpEvent(admin, 'broken_followup' as any, p.id, p.user_id,
          `Your Promise to Pay of ${remaining} ${p.currency} from ${p.promised_date} is still unpaid. Please settle to protect your credit score.`,
          { amount: String(remaining), currency: p.currency, promisedDate: p.promised_date });
        followups++;
      }

      return json({ upcoming_sent: upcomingSent, broken_followups: followups });
    }

    return json({ error: `unknown mode: ${mode}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
