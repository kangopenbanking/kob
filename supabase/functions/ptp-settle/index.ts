// Promise to Pay — settlement matcher
// Called by repayment success paths (pay-by-bank, loan-ops, payment-router-charge)
// and the daily cron sweep. Atomically marks promises kept/partial/broken.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { notifyPtpEvent } from '../_shared/ptp-notify.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function recordCreditEvent(admin: ReturnType<typeof createClient>, userId: string, eventType: string, meta: Record<string, unknown>) {
  await admin.from('credit_events').insert({ user_id: userId, event_type: eventType, metadata: meta });
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
      for (const p of overdue ?? []) {
        await admin.from('promise_to_pay').update({ status: 'broken', broken_at: new Date().toISOString() }).eq('id', p.id);
        await admin.from('promise_to_pay_events').insert({ promise_id: p.id, event_type: 'broken' });
        const missed = Number(p.promised_amount) - Number(p.kept_amount ?? 0);
        await recordCreditEvent(admin, p.user_id, 'ptp_broken', { promise_id: p.id, missed_amount: missed, via: 'sweep' });
        await notifyPtpEvent(admin, 'swept', p.id, p.user_id,
          `Promise to Pay of ${p.promised_amount} ${p.currency} was not kept by ${p.promised_date}.`,
          { missedAmount: String(missed), currency: p.currency, promisedDate: p.promised_date });
        broken++;
      }
      return json({ swept: overdue?.length ?? 0, broken });
    }

    return json({ error: `unknown mode: ${mode}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
