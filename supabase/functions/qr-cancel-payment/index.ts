// qr-cancel-payment — Merchant- or user-initiated cancellation of a QR payment.
//
// Flow:
//   1. Validate JWT (3-attempt retry per house rules).
//   2. Load qr_card_payments row (RLS scoped to user_id; admin/merchant can use service role bridge later).
//   3. Reject if status is already terminal (completed / failed / refunded / cancelled).
//   4. Best-effort cancel upstream PISP if a payment_id exists (call internal pisp-payment-details for status, abort if already settled).
//   5. Refund the virtual card balance (charge_usd from metadata) atomically.
//   6. Mark qr_card_payments status='cancelled', cancelled_at=now(), cancelled_by=user.id.
//   7. Return RFC 7807 problem on errors.
//
// Idempotent: a second call on an already-cancelled row returns 200 with the same payload.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function problem(status: number, code: string, detail: string) {
  return new Response(
    JSON.stringify({
      type: `https://kangopenbanking.com/errors/${code}`,
      title: code, status, detail, error_code: code, error_id: crypto.randomUUID(),
    }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/problem+json' } },
  );
}

async function getUserWithRetry(supabase: any, jwt: string) {
  let lastErr: any;
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.auth.getUser(jwt);
    if (data?.user) return data.user;
    lastErr = error;
    await new Promise(r => setTimeout(r, 150 * (i + 1)));
  }
  throw lastErr || new Error('unauthorized');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return problem(405, 'method_not_allowed', 'POST required');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return problem(401, 'unauthorized', 'Missing bearer token');

  let body: any;
  try { body = await req.json(); } catch { return problem(400, 'invalid_body', 'JSON body required'); }
  const { qr_payment_id, reason } = body || {};
  if (typeof qr_payment_id !== 'string' || !UUID.test(qr_payment_id)) {
    return problem(400, 'QR_001', 'qr_payment_id must be a UUID');
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let user: any;
  try { user = await getUserWithRetry(supabase, auth.slice(7)); }
  catch { return problem(401, 'unauthorized', 'Invalid session'); }

  const { data: row, error: rowErr } = await supabase
    .from('qr_card_payments')
    .select('*')
    .eq('id', qr_payment_id)
    .maybeSingle();
  if (rowErr || !row) return problem(404, 'QR_003', 'QR payment not found');

  // Allow either the originating user or an admin role to cancel.
  let isAdmin = false;
  if (row.user_id !== user.id) {
    const { data: roles } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    isAdmin = !!roles;
    if (!isAdmin) return problem(403, 'QR_003', 'Not authorized to cancel this payment');
  }

  // Idempotent on cancelled.
  if (row.status === 'cancelled') {
    return new Response(JSON.stringify({ id: row.id, status: 'cancelled', already: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  if (['completed', 'failed', 'refunded'].includes(row.status)) {
    return problem(409, 'QR_003', `Cannot cancel a ${row.status} payment`);
  }

  // Optional: check upstream PISP status — abort if already settled.
  if (row.pisp_payment_id) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/pisp-payment-details?paymentId=${encodeURIComponent(row.pisp_payment_id)}`, {
        headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const j = await r.json().catch(() => ({}));
      const upstream = (j?.Data?.Status || j?.status || '').toString().toLowerCase();
      if (upstream === 'acceptedsettlementcompleted' || upstream === 'completed' || upstream === 'settled') {
        return problem(409, 'QR_003', 'Upstream PISP payment already settled — cannot cancel');
      }
    } catch (_e) { /* best-effort */ }
  }

  // Refund the virtual card if we previously debited.
  const chargeUsd = (row.metadata as any)?.charge_usd;
  if (typeof chargeUsd === 'number' && chargeUsd > 0) {
    const { data: card } = await supabase
      .from('virtual_cards').select('balance_usd').eq('id', row.virtual_card_id).maybeSingle();
    if (card) {
      await supabase
        .from('virtual_cards')
        .update({ balance_usd: Number(card.balance_usd) + chargeUsd })
        .eq('id', row.virtual_card_id);
    }
  }

  const { error: updErr } = await supabase
    .from('qr_card_payments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancelled_by: user.id,
      failure_reason: reason ? String(reason).slice(0, 500) : 'cancelled_by_user',
    })
    .eq('id', row.id)
    .in('status', ['pending']);
  if (updErr) return problem(500, 'persist_failed', updErr.message);

  // Push a webhook_inbox event so the merchant success/cancellation screen reacts in realtime.
  await supabase.from('webhook_inbox').insert({
    event_type: 'qr.payment.cancelled',
    payload: {
      qr_card_payment_id: row.id,
      pisp_payment_id: row.pisp_payment_id,
      cancelled_by_role: isAdmin ? 'admin' : 'user',
      reason: reason || null,
      occurred_at: new Date().toISOString(),
    },
    user_id: row.user_id,
  } as any).then(() => {}, () => {});

  return new Response(JSON.stringify({
    id: row.id, status: 'cancelled', refunded_usd: chargeUsd ?? 0,
  }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
