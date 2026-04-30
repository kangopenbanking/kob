/**
 * Phase 6 — Merchant Outbound Webhooks E2E
 * ----------------------------------------
 *  Create endpoint → trigger event → delivery log shows success/failure → replay works
 *
 * Models the contract enforced by:
 *   - supabase/functions/gateway-merchant-webhooks/index.ts (CRUD + test)
 *   - supabase/functions/gateway-deliver-webhook/index.ts (delivery + retry)
 *   - supabase/functions/gateway-webhook-replay-delivery/index.ts (replay)
 */
import { describe, it, expect, beforeEach } from 'vitest';

type Endpoint = { id: string; merchant_id: string; url: string; secret: string; events: string[]; is_active: boolean };
type DeliveryEvent = {
  id: string; merchant_id: string; webhook_id: string; event_type: string;
  payload: any; status: 'pending' | 'delivered' | 'failed';
  attempts: number; last_response_code: number | null; last_response_body: string | null;
  next_retry_at: string;
};

function bus() {
  const endpoints: Endpoint[] = [];
  const events: DeliveryEvent[] = [];
  let idSeq = 1;

  const createEndpoint = (merchant_id: string, url: string, eventsList: string[]) => {
    const ep: Endpoint = { id: `wh_${idSeq++}`, merchant_id, url, secret: `whsec_${idSeq}`, events: eventsList, is_active: true };
    endpoints.push(ep); return ep;
  };

  const triggerEvent = (merchant_id: string, event_type: string, payload: any) => {
    const ep = endpoints.find((e) => e.merchant_id === merchant_id && e.is_active && (e.events.includes(event_type) || e.events.length === 0));
    if (!ep) return null;
    const ev: DeliveryEvent = {
      id: `evt_${idSeq++}`, merchant_id, webhook_id: ep.id, event_type, payload,
      status: 'pending', attempts: 0, last_response_code: null, last_response_body: null,
      next_retry_at: new Date().toISOString(),
    };
    events.push(ev); return ev;
  };

  // Simulates gateway-deliver-webhook one-pass
  const deliver = async (httpStub: (url: string) => Promise<{ ok: boolean; status: number; body: string }>) => {
    let delivered = 0, failed = 0;
    for (const ev of events.filter((e) => e.status === 'pending' && e.attempts < 7)) {
      const ep = endpoints.find((e) => e.id === ev.webhook_id)!;
      const res = await httpStub(ep.url);
      ev.attempts += 1;
      ev.last_response_code = res.status;
      ev.last_response_body = res.body.substring(0, 500);
      if (res.ok) { ev.status = 'delivered'; delivered++; }
      else if (ev.attempts >= 7) { ev.status = 'failed'; failed++; }
      else { failed++; ev.next_retry_at = new Date(Date.now() + Math.pow(2, ev.attempts) * 60_000).toISOString(); }
    }
    return { delivered, failed };
  };

  // Simulates gateway-webhook-replay-delivery
  const replay = (event_id: string) => {
    const ev = events.find((e) => e.id === event_id);
    if (!ev) return { status: 404, body: { error: 'not_found' } };
    if (ev.status === 'delivered') {
      // Create a fresh delivery row preserving original payload (replay model)
      const replayed: DeliveryEvent = {
        ...ev, id: `evt_${idSeq++}`, status: 'pending', attempts: 0,
        last_response_code: null, last_response_body: null,
        next_retry_at: new Date().toISOString(),
      };
      events.push(replayed);
      return { status: 202, body: { replayed_event_id: replayed.id, original_event_id: ev.id } };
    }
    // For failed/pending we just reset retry
    ev.status = 'pending'; ev.next_retry_at = new Date().toISOString();
    return { status: 202, body: { event_id: ev.id, status: 'requeued' } };
  };

  return { endpoints, events, createEndpoint, triggerEvent, deliver, replay };
}

describe('Phase 6 · Merchant outbound webhooks', () => {
  let b: ReturnType<typeof bus>;
  beforeEach(() => { b = bus(); });

  it('create endpoint → trigger → delivery log shows SUCCESS', async () => {
    const ep = b.createEndpoint('m1', 'https://merchant.example/webhooks', ['charge.successful']);
    expect(ep.id).toBeTruthy();
    expect(ep.secret).toMatch(/^whsec_/);

    const ev = b.triggerEvent('m1', 'charge.successful', { charge_id: 'chg_1', amount: 10000 });
    expect(ev).not.toBeNull();
    expect(ev!.status).toBe('pending');

    const result = await b.deliver(async () => ({ ok: true, status: 200, body: 'ok' }));
    expect(result.delivered).toBe(1);

    const log = b.events.find((e) => e.id === ev!.id)!;
    expect(log.status).toBe('delivered');
    expect(log.last_response_code).toBe(200);
    expect(log.attempts).toBe(1);
  });

  it('failing endpoint → delivery log shows FAILURE + retry scheduled', async () => {
    b.createEndpoint('m1', 'https://merchant.example/down', ['charge.failed']);
    const ev = b.triggerEvent('m1', 'charge.failed', { charge_id: 'chg_2' })!;

    const r1 = await b.deliver(async () => ({ ok: false, status: 500, body: 'down' }));
    expect(r1.failed).toBe(1);
    const log = b.events.find((e) => e.id === ev.id)!;
    expect(log.status).toBe('pending'); // still retrying
    expect(log.attempts).toBe(1);
    expect(log.last_response_code).toBe(500);
  });

  it('replays a delivered event, producing a new pending delivery row', async () => {
    b.createEndpoint('m1', 'https://merchant.example/webhooks', ['charge.successful']);
    const ev = b.triggerEvent('m1', 'charge.successful', { charge_id: 'chg_3' })!;
    await b.deliver(async () => ({ ok: true, status: 200, body: 'ok' }));
    expect(b.events.find((e) => e.id === ev.id)!.status).toBe('delivered');

    const r = b.replay(ev.id);
    expect(r.status).toBe(202);
    const replayedId = (r.body as any).replayed_event_id;
    const replayed = b.events.find((e) => e.id === replayedId)!;
    expect(replayed.status).toBe('pending');
    expect(replayed.payload).toEqual({ charge_id: 'chg_3' });

    const r2 = await b.deliver(async () => ({ ok: true, status: 200, body: 'ok' }));
    expect(r2.delivered).toBe(1);
    expect(b.events.find((e) => e.id === replayedId)!.status).toBe('delivered');
  });

  it('replay endpoint returns 404 for unknown event', () => {
    const r = b.replay('does_not_exist');
    expect(r.status).toBe(404);
  });

  it('events for inactive endpoints are not enqueued', () => {
    const ep = b.createEndpoint('m1', 'https://merchant.example/webhooks', ['charge.successful']);
    ep.is_active = false;
    const ev = b.triggerEvent('m1', 'charge.successful', { x: 1 });
    expect(ev).toBeNull();
  });
});
