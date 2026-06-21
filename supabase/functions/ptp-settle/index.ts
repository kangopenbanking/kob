// Promise to Pay — settlement matcher
// Called by repayment success paths (pay-by-bank, loan-ops, payment-router-charge)
// and the daily cron sweep. Atomically marks promises kept/partial/broken.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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
        await admin.from('promise_to_pay_events').insert({
          promise_id: open.id, event_type: status === 'partially_kept' ? 'partial' : status, amount: newKept,
        });
        await recordCreditEvent(admin, open.user_id, `ptp_${status === 'partially_kept' ? 'partial' : status}`, { promise_id: open.id, amount: newKept });
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
        await recordCreditEvent(admin, p.user_id, 'ptp_broken', { promise_id: p.id, missed_amount: Number(p.promised_amount) - Number(p.kept_amount ?? 0) });
        broken++;
      }
      return json({ swept: overdue?.length ?? 0, broken });
    }

    return json({ error: `unknown mode: ${mode}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
