// @ts-nocheck
/**
 * v4.27.3 regression guard — every gap closed by the v4.27.3 patch must
 * stay closed for all future versions (Standing Order 2 — The Ratchet).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SPEC_PATH = path.resolve(__dirname, '../../public/openapi.json');
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));

const OPS: Array<{ p: string; m: string; op: any }> = [];
for (const [p, item] of Object.entries<any>(spec.paths)) {
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    if (item[m]) OPS.push({ p, m, op: item[m] });
  }
}

const PUBLIC_OP_IDS = new Set([
  'oidcConfig', 'jwksEndpoint', 'getJwksWellKnown',
  'apiHealth', 'apiReady', 'securityHealthz', 'directoryBanksCm',
]);

describe('OpenAPI v4.27.3 — Guardian regression floors', () => {
  it('info.version is at least 4.27.3', () => {
    const [maj, min, pat] = String(spec.info.version).split('.').map(Number);
    expect(maj).toBeGreaterThanOrEqual(4);
    if (maj === 4 && min === 27) expect(pat).toBeGreaterThanOrEqual(3);
  });

  it('legacy /webhooks/* provider paths are absent (regression fixed in v4.3.0)', () => {
    for (const p of ['/webhooks/stripe', '/webhooks/flutterwave', '/webhooks/paypal']) {
      expect(spec.paths[p], `legacy path ${p} must not exist`).toBeUndefined();
    }
  });

  it('canonical /v1/webhooks/providers/* paths exist', () => {
    for (const p of ['/v1/webhooks/providers/stripe', '/v1/webhooks/providers/flutterwave', '/v1/webhooks/providers/paypal']) {
      expect(spec.paths[p]?.post?.operationId, `${p} must declare a POST`).toBeTruthy();
    }
  });

  it('every tag used by an operation is declared in global tags[]', () => {
    const declared = new Set((spec.tags || []).map((t: any) => t.name));
    const used = new Set<string>();
    for (const { op } of OPS) (op.tags || []).forEach((t: string) => used.add(t));
    const undeclared = [...used].filter((t) => !declared.has(t));
    expect(undeclared).toEqual([]);
  });

  it('every operation declares a 429 response', () => {
    const missing = OPS.filter(({ op }) => !op.responses?.['429']).map(({ op, m, p }) => op.operationId || `${m} ${p}`);
    expect(missing).toEqual([]);
  });

  it('every non-public operation declares a 401 response', () => {
    const missing = OPS
      .filter(({ op }) => !PUBLIC_OP_IDS.has(op.operationId) && !op.responses?.['401'])
      .map(({ op, m, p }) => op.operationId || `${m} ${p}`);
    expect(missing).toEqual([]);
  });

  it('every non-public POST/PUT/PATCH declares a 400 response', () => {
    const missing = OPS
      .filter(({ m, op }) => ['post', 'put', 'patch'].includes(m)
        && !PUBLIC_OP_IDS.has(op.operationId)
        && !op.responses?.['400'])
      .map(({ op, m, p }) => op.operationId || `${m} ${p}`);
    expect(missing).toEqual([]);
  });

  it('every 200/201 inline response declares the x-fapi-interaction-id header', () => {
    const missing: string[] = [];
    for (const { op, m, p } of OPS) {
      for (const code of ['200', '201']) {
        const r = op.responses?.[code];
        if (!r || r.$ref) continue;
        const has = Object.keys(r.headers || {}).some((h) => h.toLowerCase() === 'x-fapi-interaction-id');
        if (!has) { missing.push(`${op.operationId || (m + ' ' + p)} ${code}`); break; }
      }
    }
    expect(missing).toEqual([]);
  });

  it('shared XFapiInteractionId header component exists', () => {
    expect(spec.components?.headers?.XFapiInteractionId).toBeTruthy();
    expect(spec.components.headers.XFapiInteractionId.schema?.type).toBe('string');
  });

  it('flagged schemas declare required[] arrays', () => {
    const expected = {
      WebhookReplayRequest: ['delivery_id'],
      DcrRegistrationRequest: ['client_name', 'redirect_uris', 'token_endpoint_auth_method'],
      WebhookEventType: ['type', 'version'],
    };
    for (const [name, required] of Object.entries(expected)) {
      const sch = spec.components?.schemas?.[name];
      expect(sch, `schema ${name} must exist`).toBeTruthy();
      for (const f of required) {
        expect(sch.required || [], `schema ${name} must require ${f}`).toContain(f);
      }
    }
  });

  it('changelog file exists for v4.27.3', () => {
    const cl = path.resolve(__dirname, '../../docs/governance/CHANGELOG-v4.27.3.md');
    expect(fs.existsSync(cl)).toBe(true);
  });
});
