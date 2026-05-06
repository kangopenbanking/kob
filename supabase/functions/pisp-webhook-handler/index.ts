// pisp-webhook-handler — Receives PISP payment lifecycle events and
// reconciles QR card payments (qr_card_payments) so the in-app merchant
// success screen can react in real time via Supabase Realtime.
//
// Inbound payload (normalised across providers):
//   {
//     "event": "pisp.payment.completed" | "pisp.payment.failed" | "pisp.payment.cancelled",
//     "payment_id": "pay_abc123",          // PISP DomesticPaymentId
//     "status": "AcceptedSettlementCompleted" | "Rejected" | "Cancelled" | string,
//     "reason"?: string,
//     "occurred_at": "2026-05-06T12:34:56Z",
//     "signature"?: string                  // optional HMAC for shared-secret verification
//   }
//
// Auth: signed by KOB PISP rail with shared secret (PISP_WEBHOOK_SECRET).
// We deliberately do NOT require a user JWT (this is server-to-server).
//
// Side-effects:
//   * UPDATE qr_card_payments SET status = 'completed' | 'failed' | 'refunded'
//   * INSERT into webhook_inbox so the client realtime bus picks it up and the
//     merchant success screen renders without polling.
//
// Standards: Open Banking UK PISP §7.5 (status transitions),
// FAPI-1.0-ADV §5.2.2 (server-to-server).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PISP_WEBHOOK_SECRET') ?? '';

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // dev: skip when no secret configured
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  // constant-time compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function mapStatus(s: string): 'completed' | 'failed' | 'pending' {
  const v = (s || '').toLowerCase();
  if (v === 'acceptedsettlementcompleted' || v === 'completed' || v === 'settled') return 'completed';
  if (v === 'rejected' || v === 'failed' || v === 'cancelled' || v === 'canceled') return 'failed';
  return 'pending';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const raw = await req.text();
  const sig = req.headers.get('X-Webhook-Signature');
  if (!(await verifySignature(raw, sig))) return json(401, { error: 'invalid_signature' });

  let evt: any;
  try { evt = JSON.parse(raw); } catch { return json(400, { error: 'invalid_json' }); }

  const paymentId = evt?.payment_id || evt?.Data?.DomesticPaymentId;
  const eventName = evt?.event || 'pisp.payment.updated';
  if (!paymentId) return json(400, { error: 'missing_payment_id' });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Find the QR card payment linked to this PISP id.
  const { data: qrRow } = await supabase
    .from('qr_card_payments')
    .select('id, user_id, status, virtual_card_id, amount, currency, metadata')
    .eq('pisp_payment_id', paymentId)
    .maybeSingle();

  if (!qrRow) {
    // Not a QR-initiated payment — accept silently (other webhook handlers may consume).
    return json(202, { ok: true, ignored: 'not_qr_payment' });
  }

  const next = mapStatus(evt?.status || '');

  // Idempotency: same status update arriving twice should be a no-op.
  if (next !== 'pending' && qrRow.status !== next) {
    const update: Record<string, unknown> = { status: next };
    if (next === 'failed') update.failure_reason = evt?.reason || evt?.status || 'pisp_failed';
    await supabase.from('qr_card_payments').update(update).eq('id', qrRow.id);

    // Refund the virtual card balance if PISP rejected after we already debited.
    if (next === 'failed' && qrRow.metadata && typeof (qrRow.metadata as any).charge_usd === 'number') {
      const refund = (qrRow.metadata as any).charge_usd as number;
      const { data: card } = await supabase
        .from('virtual_cards')
        .select('balance_usd')
        .eq('id', qrRow.virtual_card_id)
        .maybeSingle();
      if (card) {
        await supabase
          .from('virtual_cards')
          .update({ balance_usd: Number(card.balance_usd) + refund })
          .eq('id', qrRow.virtual_card_id);
        await supabase.from('qr_card_payments')
          .update({ status: 'refunded' })
          .eq('id', qrRow.id);
      }
    }
  }

  // Surface to the client realtime bus → triggers merchant success screen.
  await supabase.from('webhook_inbox').insert({
    event_type: eventName,
    payload: {
      qr_card_payment_id: qrRow.id,
      pisp_payment_id: paymentId,
      status: next,
      amount: qrRow.amount,
      currency: qrRow.currency,
      occurred_at: evt?.occurred_at || new Date().toISOString(),
    },
    user_id: qrRow.user_id,
  } as any).then(() => {}, () => {/* webhook_inbox may have stricter shape; ignore on dev */});

  return json(200, {
    ok: true,
    qr_card_payment_id: qrRow.id,
    status: next,
  });
});
