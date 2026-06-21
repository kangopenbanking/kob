// Promise to Pay — admin operations
// Direct backend: https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/ptp-admin-ops
// Admin-only via has_role(auth.uid(), 'admin'). All actions write to
// promise_to_pay_events and audit_logs.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { notifyPtpEvent } from '../_shared/ptp-notify.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function requireAdmin(req: Request) {
  const authz = req.headers.get('Authorization') ?? '';
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authz } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' as any });
  if (!isAdmin) return null;
  return { user, admin };
}

async function audit(admin: ReturnType<typeof createClient>, actorId: string, action: string, target: string, before: any, after: any, reason?: string) {
  try {
    await admin.from('audit_logs').insert({
      user_id: actorId, action: `ptp.${action}`,
      resource_type: 'promise_to_pay', resource_id: target,
      metadata: { before, after, reason },
    });
  } catch (_) { /* non-fatal */ }
  await admin.from('promise_to_pay_events').insert({
    promise_id: target, event_type: `admin_${action}`,
    metadata: { actor_id: actorId, before, after, reason },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ctx = await requireAdmin(req);
  if (!ctx) return json({ error: 'forbidden' }, 403);
  const { user, admin } = ctx;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? (await req.clone().json().catch(() => ({}))).action ?? 'list';

  try {
    if (req.method === 'GET' || action === 'list') {
      const q = url.searchParams;
      const status = q.get('status');
      const search = q.get('search')?.trim();
      const from = q.get('from');
      const to = q.get('to');
      const limit = Math.min(Number(q.get('limit') ?? 50), 200);

      let query = admin.from('promise_to_pay')
        .select('*, profiles:user_id(email, full_name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (status) query = query.eq('status', status);
      if (from) query = query.gte('promised_date', from);
      if (to) query = query.lte('promised_date', to);
      if (search) {
        // search by promise id, loan id, user id (UUID prefix) — and email via profiles join
        if (search.length >= 4) {
          query = query.or(`id.ilike.${search}%,loan_account_id.ilike.${search}%,user_id.ilike.${search}%`);
        }
      }
      const { data, error, count } = await query;
      if (error) throw error;
      return json({ promises: data, count });
    }

    const body = await req.json().catch(() => ({}));

    if (action === 'detail') {
      const { promise_id } = body;
      const { data: p } = await admin.from('promise_to_pay').select('*, profiles:user_id(email, full_name)').eq('id', promise_id).maybeSingle();
      if (!p) return json({ error: 'not_found' }, 404);
      const { data: events } = await admin.from('promise_to_pay_events').select('*').eq('promise_id', promise_id).order('created_at', { ascending: true });
      const { data: credit } = await admin.from('credit_events').select('*').eq('user_id', (p as any).user_id).like('event_type', 'ptp_%').order('created_at', { ascending: false }).limit(50);
      return json({ promise: p, events, credit_events: credit });
    }

    if (action === 'cancel') {
      const { promise_id, reason } = body;
      const { data: before } = await admin.from('promise_to_pay').select('*').eq('id', promise_id).maybeSingle();
      if (!before) return json({ error: 'not_found' }, 404);
      const { data: after, error } = await admin.from('promise_to_pay').update({ status: 'cancelled' }).eq('id', promise_id).select('*').single();
      if (error) throw error;
      await audit(admin, user.id, 'cancel', promise_id, before, after, reason);
      return json({ promise: after });
    }

    if (action === 'reschedule') {
      const { promise_id, promised_date, reason } = body;
      if (!promised_date) return json({ error: 'promised_date required' }, 400);
      const { data: before } = await admin.from('promise_to_pay').select('*').eq('id', promise_id).maybeSingle();
      if (!before) return json({ error: 'not_found' }, 404);
      const { data: after, error } = await admin.from('promise_to_pay').update({ promised_date }).eq('id', promise_id).select('*').single();
      if (error) throw error;
      await audit(admin, user.id, 'reschedule', promise_id, before, after, reason);
      await notifyPtpEvent(admin, 'rescheduled', promise_id, (before as any).user_id,
        `Admin rescheduled your Promise to Pay to ${promised_date}.`,
        { amount: String((before as any).promised_amount), currency: (before as any).currency, newDate: promised_date, reason });
      return json({ promise: after });
    }

    if (action === 'override_credit') {
      const { promise_id, event_type, points_delta, reason } = body;
      if (!event_type || !reason) return json({ error: 'event_type and reason required' }, 400);
      const { data: p } = await admin.from('promise_to_pay').select('*').eq('id', promise_id).maybeSingle();
      if (!p) return json({ error: 'not_found' }, 404);
      const { data: ce, error } = await admin.from('credit_events').insert({
        user_id: (p as any).user_id,
        event_type,
        metadata: { promise_id, source: 'admin_override', points_delta, reason, actor_id: user.id },
      }).select('*').single();
      if (error) throw error;
      await audit(admin, user.id, 'override_credit', promise_id, null, ce, reason);
      return json({ credit_event: ce });
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
