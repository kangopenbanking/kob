// Promise to Pay — CRUD + lifecycle router
// Direct backend: https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/ptp-ops
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { notifyPtpEvent } from '../_shared/ptp-notify.ts';
import { dispatchPtpWebhook } from '../_shared/ptp-webhook.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getUser(req: Request) {
  const authz = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authz } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

async function recordCreditEvent(admin: ReturnType<typeof createClient>, userId: string, eventType: string, meta: Record<string, unknown>) {
  await admin.from('credit_events').insert({
    user_id: userId,
    event_type: eventType,
    metadata: meta,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const user = await getUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? (await req.clone().json().catch(() => ({}))).action ?? 'list';

  try {
    if (req.method === 'GET' || action === 'list') {
      const { data, error } = await admin
        .from('promise_to_pay')
        .select('*, promise_to_pay_events(*)')
        .eq('user_id', user.id)
        .order('promised_date', { ascending: false });
      if (error) throw error;
      return json({ promises: data });
    }

    const body = await req.json().catch(() => ({}));

    if (action === 'create') {
      const { loan_account_id, promised_amount, promised_date, payment_method = 'pay_by_bank', currency = 'GBP', idempotency_key } = body ?? {};
      if (!loan_account_id || !promised_amount || !promised_date) {
        return json({ error: 'loan_account_id, promised_amount, promised_date required' }, 400);
      }
      if (idempotency_key) {
        const { data: existing } = await admin
          .from('promise_to_pay').select('*').eq('idempotency_key', idempotency_key).maybeSingle();
        if (existing) return json({ promise: existing, idempotent: true });
      }
      const { data, error } = await admin
        .from('promise_to_pay')
        .insert({
          user_id: user.id,
          loan_account_id,
          promised_amount,
          promised_date,
          payment_method,
          currency,
          idempotency_key: idempotency_key ?? crypto.randomUUID(),
        })
        .select('*').single();
      if (error) return json({ error: error.message }, 400);
      await admin.from('promise_to_pay_events').insert({
        promise_id: data.id, event_type: 'created', amount: promised_amount,
        metadata: { payment_method, currency },
      });
      await recordCreditEvent(admin, user.id, 'ptp_created', { promise_id: data.id });
      await notifyPtpEvent(admin, 'created', data.id, user.id,
        `Promise to Pay of ${promised_amount} ${currency} scheduled for ${promised_date}.`,
        { amount: String(promised_amount), currency, promisedDate: promised_date, reference: `PTP-${String(data.id).slice(0, 8).toUpperCase()}` });
      await dispatchPtpWebhook(admin, 'ptp.created', {
        promise_id: data.id, user_id: user.id, loan_account_id,
        amount: promised_amount, currency, promised_date, status: data.status,
        data: { payment_method },
      });
      return json({ promise: data });
    }

    if (action === 'cancel') {
      const { promise_id } = body ?? {};
      const { data: p } = await admin.from('promise_to_pay').select('*').eq('id', promise_id).eq('user_id', user.id).maybeSingle();
      if (!p) return json({ error: 'not_found' }, 404);
      if (p.status !== 'scheduled') return json({ error: 'cannot_cancel' }, 400);
      const { data, error } = await admin.from('promise_to_pay').update({ status: 'cancelled' }).eq('id', promise_id).select('*').single();
      if (error) throw error;
      await admin.from('promise_to_pay_events').insert({ promise_id, event_type: 'cancelled' });
      await dispatchPtpWebhook(admin, 'ptp.cancelled', {
        promise_id, user_id: user.id, loan_account_id: p.loan_account_id,
        amount: p.promised_amount, currency: p.currency, promised_date: p.promised_date, status: 'cancelled',
      });
      return json({ promise: data });
    }

    if (action === 'reschedule') {
      const { promise_id, promised_amount, promised_date, reason } = body ?? {};
      const { data: orig } = await admin.from('promise_to_pay').select('*').eq('id', promise_id).eq('user_id', user.id).maybeSingle();
      if (!orig) return json({ error: 'not_found' }, 404);
      if (!['scheduled', 'partially_kept'].includes(orig.status)) return json({ error: 'cannot_reschedule' }, 400);

      const { data: child, error: insErr } = await admin.from('promise_to_pay').insert({
        user_id: user.id,
        loan_account_id: orig.loan_account_id,
        promised_amount: promised_amount ?? orig.promised_amount,
        promised_date,
        payment_method: orig.payment_method,
        currency: orig.currency,
        reschedule_of: orig.id,
        reason,
        idempotency_key: crypto.randomUUID(),
      }).select('*').single();
      if (insErr) return json({ error: insErr.message }, 400);

      await admin.from('promise_to_pay').update({ status: 'rescheduled' }).eq('id', orig.id);
      await admin.from('promise_to_pay_events').insert([
        { promise_id: orig.id, event_type: 'rescheduled', metadata: { child: child.id, reason } },
        { promise_id: child.id, event_type: 'created', amount: child.promised_amount, metadata: { rescheduled_from: orig.id } },
      ]);

      // Detect repeat reschedule within 30d for credit penalty
      const { count } = await admin
        .from('promise_to_pay')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'rescheduled')
        .gte('updated_at', new Date(Date.now() - 30 * 86400000).toISOString());
      const isRepeat = (count ?? 0) > 1;
      await recordCreditEvent(admin, user.id, isRepeat ? 'ptp_rescheduled_repeat' : 'ptp_rescheduled', { promise_id: orig.id, child_id: child.id });
      await notifyPtpEvent(admin, 'rescheduled', child.id, user.id,
        `Promise to Pay rescheduled to ${promised_date}.`,
        { amount: String(child.promised_amount), currency: child.currency, newDate: promised_date, reason, isRepeat });
      await dispatchPtpWebhook(admin, 'ptp.rescheduled', {
        promise_id: child.id, user_id: user.id, loan_account_id: child.loan_account_id,
        amount: child.promised_amount, currency: child.currency, promised_date,
        status: child.status,
        data: { rescheduled_from: orig.id, reason, repeat: isRepeat },
      });
      return json({ promise: child, original: orig.id });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
