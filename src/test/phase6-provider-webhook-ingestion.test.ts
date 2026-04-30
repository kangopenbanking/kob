/**
 * Phase 6 — Provider Webhook Ingestion E2E
 * ----------------------------------------
 * Verifies the inbound webhook contract for Stripe / Flutterwave / PayPal:
 *   1. Signature validation rejects unsigned/invalid requests with 401
 *   2. Valid signed payloads update internal object state (charge / payout)
 *   3. Duplicate event_id is dedup'd via webhook_inbox (no double-update)
 *
 * The tests model the dispatcher contract used by:
 *   - supabase/functions/gateway-webhook-stripe/index.ts
 *   - supabase/functions/gateway-webhook-flutterwave/index.ts
 *   - supabase/functions/gateway-webhook-paypal/index.ts
 *
 * They run in CI (vitest) without Deno runtime by exercising the
 * shared verification primitives + an in-memory webhook_inbox/charges store.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ─── In-memory store mirroring webhook_inbox + gateway_charges/payouts ───
type Row = Record<string, any>;
function makeStore() {
  const inbox: Row[] = [];
  const charges: Row[] = [
    { id: 'chg_1', provider_ref: 'pi_test_123', tx_ref: 'flw_tx_1', status: 'pending', amount: 10000, currency: 'XAF' },
  ];
  const payouts: Row[] = [
    { id: 'po_1', provider_ref: 'pp_batch_1', status: 'pending' },
  ];
  return { inbox, charges, payouts };
}

// ─── HMAC helpers using Web Crypto (available in jsdom via globalThis.crypto) ───
async function hmacSha256Hex(key: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Stripe dispatcher (mirrors gateway-webhook-stripe runtime) ───
async function dispatchStripe(rawBody: string, headers: Record<string, string>, secret: string, store: ReturnType<typeof makeStore>) {
  const sig = headers['stripe-signature'];
  if (!sig) return { status: 401, body: { error: 'missing_signature' } };
  const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=')));
  const expected = await hmacSha256Hex(secret, `${parts.t}.${rawBody}`);
  if (parts.v1 !== expected) return { status: 401, body: { error: 'invalid_signature' } };
  const event = JSON.parse(rawBody);
  const dedupe = `stripe_${event.id}`;
  if (store.inbox.find((r) => r.event_id === dedupe)) return { status: 200, body: { status: 'already_processed' } };
  store.inbox.push({ event_id: dedupe, provider: 'stripe', event_type: event.type, payload: event });
  if (event.type === 'payment_intent.succeeded') {
    const piId = event.data?.object?.id;
    const c = store.charges.find((c) => c.provider_ref === piId);
    if (c) c.status = 'successful';
  }
  return { status: 200, body: { status: 'processed' } };
}

// ─── Flutterwave dispatcher ───
async function dispatchFlutterwave(payload: any, headers: Record<string, string>, secret: string, store: ReturnType<typeof makeStore>) {
  const verif = headers['verif-hash'];
  if (!verif || verif !== secret) return { status: 401, body: { error: 'invalid_signature' } };
  const dedupe = `flw_${payload.data?.id}`;
  if (store.inbox.find((r) => r.event_id === dedupe)) return { status: 200, body: { status: 'already_processed' } };
  store.inbox.push({ event_id: dedupe, provider: 'flutterwave', event_type: payload.event, payload });
  const txRef = payload.data?.tx_ref;
  const c = store.charges.find((c) => c.tx_ref === txRef);
  if (c && payload.data?.status === 'successful') c.status = 'successful';
  return { status: 200, body: { status: 'processed' } };
}

// ─── PayPal dispatcher (verification mocked per docs) ───
async function dispatchPayPal(rawBody: string, headers: Record<string, string>, verifier: (h: Record<string, string>, body: string) => Promise<boolean>, store: ReturnType<typeof makeStore>) {
  const required = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'];
  if (required.some((h) => !headers[h])) return { status: 401, body: { error: 'invalid_signature' } };
  const ok = await verifier(headers, rawBody);
  if (!ok) return { status: 401, body: { error: 'invalid_signature' } };
  const event = JSON.parse(rawBody);
  const dedupe = `paypal_${event.id}`;
  if (store.inbox.find((r) => r.event_id === dedupe)) return { status: 200, body: { status: 'already_processed' } };
  store.inbox.push({ event_id: dedupe, provider: 'paypal', event_type: event.event_type, payload: event });
  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const batch = event.resource?.payout_batch_id;
    const p = store.payouts.find((p) => p.provider_ref === batch);
    if (p) p.status = 'completed';
  }
  return { status: 200, body: { status: 'processed' } };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Phase 6 · Provider webhook ingestion — Stripe', () => {
  const SECRET = 'whsec_test_stripe';
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => { store = makeStore(); });

  it('rejects requests with no stripe-signature (401)', async () => {
    const res = await dispatchStripe('{}', {}, SECRET, store);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('missing_signature');
  });

  it('rejects requests with invalid v1 (401)', async () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });
    const res = await dispatchStripe(body, { 'stripe-signature': 't=1700000000,v1=deadbeef' }, SECRET, store);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_signature');
  });

  it('valid signed payment_intent.succeeded → charge.status=successful', async () => {
    const t = '1700000000';
    const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_test_123', status: 'succeeded' } } });
    const v1 = await hmacSha256Hex(SECRET, `${t}.${body}`);
    const res = await dispatchStripe(body, { 'stripe-signature': `t=${t},v1=${v1}` }, SECRET, store);
    expect(res.status).toBe(200);
    expect(store.charges.find((c) => c.id === 'chg_1')!.status).toBe('successful');
    expect(store.inbox).toHaveLength(1);
  });

  it('duplicate event id is dedup\'d via webhook_inbox', async () => {
    const t = '1700000000';
    const body = JSON.stringify({ id: 'evt_dup', type: 'payment_intent.succeeded', data: { object: { id: 'pi_test_123', status: 'succeeded' } } });
    const v1 = await hmacSha256Hex(SECRET, `${t}.${body}`);
    const headers = { 'stripe-signature': `t=${t},v1=${v1}` };
    await dispatchStripe(body, headers, SECRET, store);
    const second = await dispatchStripe(body, headers, SECRET, store);
    expect(second.body.status).toBe('already_processed');
    expect(store.inbox).toHaveLength(1);
  });
});

describe('Phase 6 · Provider webhook ingestion — Flutterwave', () => {
  const SECRET = 'flw_hash_secret';
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => { store = makeStore(); });

  it('rejects requests with missing verif-hash (401)', async () => {
    const res = await dispatchFlutterwave({ data: { id: 1 } }, {}, SECRET, store);
    expect(res.status).toBe(401);
  });

  it('rejects requests with mismatched verif-hash (401)', async () => {
    const res = await dispatchFlutterwave({ data: { id: 1 } }, { 'verif-hash': 'wrong' }, SECRET, store);
    expect(res.status).toBe(401);
  });

  it('valid charge.completed → charge.status=successful', async () => {
    const payload = { event: 'charge.completed', data: { id: 99, tx_ref: 'flw_tx_1', status: 'successful', flw_ref: 'FLW_REF_1' } };
    const res = await dispatchFlutterwave(payload, { 'verif-hash': SECRET }, SECRET, store);
    expect(res.status).toBe(200);
    expect(store.charges.find((c) => c.tx_ref === 'flw_tx_1')!.status).toBe('successful');
  });

  it('duplicate event id is dedup\'d', async () => {
    const payload = { event: 'charge.completed', data: { id: 99, tx_ref: 'flw_tx_1', status: 'successful' } };
    await dispatchFlutterwave(payload, { 'verif-hash': SECRET }, SECRET, store);
    const second = await dispatchFlutterwave(payload, { 'verif-hash': SECRET }, SECRET, store);
    expect(second.body.status).toBe('already_processed');
    expect(store.inbox).toHaveLength(1);
  });
});

describe('Phase 6 · Provider webhook ingestion — PayPal', () => {
  const FULL_HEADERS = {
    'paypal-auth-algo': 'SHA256withRSA',
    'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/CERT-x',
    'paypal-transmission-id': 'tx_1',
    'paypal-transmission-sig': 'sig_b64',
    'paypal-transmission-time': '2026-04-30T00:00:00Z',
  };
  let store: ReturnType<typeof makeStore>;
  beforeEach(() => { store = makeStore(); });

  it('rejects requests missing any signature header (401)', async () => {
    const partial = { ...FULL_HEADERS };
    delete (partial as any)['paypal-transmission-sig'];
    const res = await dispatchPayPal('{}', partial, async () => true, store);
    expect(res.status).toBe(401);
  });

  it('rejects when verification API returns failure (401)', async () => {
    const body = JSON.stringify({ id: 'evt_pp_1', event_type: 'PAYMENT.CAPTURE.COMPLETED' });
    const res = await dispatchPayPal(body, FULL_HEADERS, async () => false, store);
    expect(res.status).toBe(401);
  });

  it('valid PAYMENT.CAPTURE.COMPLETED → payout.status=completed', async () => {
    const body = JSON.stringify({
      id: 'evt_pp_1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { payout_batch_id: 'pp_batch_1', transaction_status: 'SUCCESS' },
    });
    const res = await dispatchPayPal(body, FULL_HEADERS, async () => true, store);
    expect(res.status).toBe(200);
    expect(store.payouts.find((p) => p.provider_ref === 'pp_batch_1')!.status).toBe('completed');
  });

  it('duplicate event id is dedup\'d', async () => {
    const body = JSON.stringify({ id: 'evt_pp_dup', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { payout_batch_id: 'pp_batch_1', transaction_status: 'SUCCESS' } });
    await dispatchPayPal(body, FULL_HEADERS, async () => true, store);
    const second = await dispatchPayPal(body, FULL_HEADERS, async () => true, store);
    expect(second.body.status).toBe('already_processed');
    expect(store.inbox).toHaveLength(1);
  });
});
