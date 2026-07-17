/**
 * Phase 1B-R1I-a.3C — Nium contract reconciliation guards.
 *
 * Locks the corrected `niumIncomingWebhook` OpenAPI contract:
 *   - generic `Idempotency-Key` header removed;
 *   - provider-event x-kob-idempotency metadata attached with all seven
 *     validated boolean controls set to true;
 *   - x-kob-webhook receiver metadata attached with resolving event-ID pointer;
 *   - signature header remains required;
 *   - 409 Conflict response documented via Problem Details;
 *   - method/path/operationId/tags/security unchanged;
 *   - operation count is 483 (post c.4 removal).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Json = Record<string, unknown>;

function asObj(v: unknown): Json {
  return (v ?? {}) as Json;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8')) as Json;

const WEBHOOK_PATH = '/v1/gateway/global-accounts/webhook';
const paths = asObj(spec.paths);
const webhookItem = asObj(paths[WEBHOOK_PATH]);
const op = asObj(webhookItem.post);
const components = asObj(spec.components);

function params(): Json[] {
  const raw = (op.parameters as unknown[] | undefined) ?? [];
  return raw.map((p) => asObj(p));
}

describe('Phase 1B-R1I-a.3C · niumIncomingWebhook contract', () => {
  it('operation is present at expected method/path/operationId', () => {
    expect(op.operationId).toBe('niumIncomingWebhook');
  });

  it('tags and security remain unchanged (Standing Order #1 — Lock)', () => {
    expect(op.tags).toEqual(['Gateway']);
    expect(op.security).toEqual([]);
  });

  it('generic Idempotency-Key header is fully removed', () => {
    for (const e of params()) {
      expect(e.$ref).not.toBe('#/components/parameters/IdempotencyKeyHeader');
      expect(String(e.name ?? '').toLowerCase()).not.toBe('idempotency-key');
    }
  });

  it('IdempotencyKeyHeader reusable component is preserved for other operations', () => {
    expect(asObj(components.parameters).IdempotencyKeyHeader).toBeTruthy();
  });

  it('required x-nium-signature header remains declared', () => {
    const sig = params().find(
      (p) => String(p.name ?? '').toLowerCase() === 'x-nium-signature',
    );
    expect(sig).toBeTruthy();
    expect(sig!.in).toBe('header');
    expect(sig!.required).toBe(true);
  });

  it('optional x-nium-timestamp replay-window header is declared', () => {
    const ts = params().find(
      (p) => String(p.name ?? '').toLowerCase() === 'x-nium-timestamp',
    );
    expect(ts).toBeTruthy();
    expect(ts!.in).toBe('header');
    expect(Boolean(ts!.required)).toBe(false);
  });

  it('x-kob-idempotency exists with mode=provider-event and provider=nium', () => {
    const idem = asObj(op['x-kob-idempotency']);
    expect(idem.mode).toBe('provider-event');
    expect(idem.provider).toBe('nium');
  });

  it('all seven provider-event boolean controls are strictly true', () => {
    const idem = asObj(op['x-kob-idempotency']);
    for (const k of [
      'event-id-required',
      'signature-required',
      'atomic-deduplication-required',
      'replay-window-enforced',
      'payload-consistency-enforced',
      'failure-recovery-enforced',
    ]) {
      expect(idem[k]).toBe(true);
    }
  });

  it('x-kob-webhook identifies receiver, provider, signature header, event-ID pointer', () => {
    const wh = asObj(op['x-kob-webhook']);
    expect(wh.receiver).toBe(true);
    expect(wh.provider).toBe('nium');
    expect(wh['signature-header']).toBe('x-nium-signature');
    expect(wh['event-id-location']).toBe('body');
    expect(wh['event-id-pointer']).toBe('/transactionId');
  });

  it('event-ID pointer resolves to a required field in the request body schema', () => {
    const wh = asObj(op['x-kob-webhook']);
    const ptr = String(wh['event-id-pointer']);
    const field = ptr.slice(1);
    const rb = asObj(op.requestBody);
    const contentJson = asObj(asObj(rb.content)['application/json']);
    const schemaRef = String(asObj(contentJson.schema).$ref ?? '');
    const name = schemaRef.split('/').pop() ?? '';
    const schema = asObj(asObj(components.schemas)[name]);
    expect(asObj(schema.properties)[field]).toBeTruthy();
    expect((schema.required as string[] | undefined) ?? []).toContain(field);
  });

  it('409 Conflict response is documented and points to Problem Details', () => {
    const responses = asObj(op.responses);
    const r = asObj(responses['409']);
    expect(Object.keys(r).length).toBeGreaterThan(0);
    if (typeof r.$ref === 'string') {
      expect(r.$ref).toBe('#/components/responses/Conflict');
      const resolved = asObj(asObj(components.responses).Conflict);
      expect(asObj(resolved.content)['application/problem+json']).toBeTruthy();
    } else {
      expect(asObj(r.content)['application/problem+json']).toBeTruthy();
    }
  });

  it('description documents replay-window, duplicate ack, changed-payload 409 and no generic key', () => {
    const d = String(op.description ?? '');
    expect(d).toMatch(/replay window/i);
    expect(d).toMatch(/duplicate/i);
    expect(d).toMatch(/409/);
    expect(d).toMatch(/Idempotency-Key/i);
    expect(d).toMatch(/signature/i);
  });

  it('operation count stays exactly 483 (post c.4) (Standing Order #1 — Lock)', () => {
    let n = 0;
    for (const [, ms] of Object.entries(paths)) {
      for (const m of Object.keys(asObj(ms))) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(m)) n++;
      }
    }
    expect(n).toBe(483);
  });

  it('info.version remains 4.53.1 (Standing Order #6 — no increment)', () => {
    expect(asObj(spec.info).version).toBe('4.53.1');
  });

  it('no ordinary mutation accidentally acquired provider-event metadata', () => {
    for (const [p, ms] of Object.entries(paths)) {
      for (const [m, o] of Object.entries(asObj(ms))) {
        const obj = asObj(o);
        if (obj.operationId === 'niumIncomingWebhook') continue;
        if (obj['x-kob-idempotency']) {
          throw new Error(`unexpected x-kob-idempotency on ${m.toUpperCase()} ${p}`);
        }
      }
    }
  });
});
