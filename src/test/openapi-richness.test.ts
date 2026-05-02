import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Stripe-grade richness ratchet (Standing Order 2 — The Ratchet).
 * These thresholds may only move UP. If a future change drops below
 * them, this test fails the build.
 */
describe('OpenAPI richness floor', () => {
  const spec = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../public/openapi.json'), 'utf8')
  );

  const ops: Array<{ path: string; method: string; op: any }> = [];
  for (const [p, item] of Object.entries<any>(spec.paths)) {
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      if (item[m]) ops.push({ path: p, method: m, op: item[m] });
    }
  }

  it('every operation declares x-codeSamples (cURL/Node/Python/PHP)', () => {
    const missing = ops.filter(({ op }) => !(op['x-codeSamples']?.length >= 4));
    expect(missing.map(o => `${o.method.toUpperCase()} ${o.path}`)).toEqual([]);
  });

  it('every 2xx response carries an example', () => {
    const missing: string[] = [];
    for (const { path: p, method, op } of ops) {
      for (const [code, r] of Object.entries<any>(op.responses ?? {})) {
        if (!String(code).startsWith('2')) continue;
        if (r?.$ref) continue;
        const ct = r?.content?.['application/json'];
        if (!ct?.examples && !ct?.example) {
          missing.push(`${method.toUpperCase()} ${p} ${code}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('every 4xx/5xx response carries a problem+json example', () => {
    const missing: string[] = [];
    for (const { path: p, method, op } of ops) {
      for (const [code, r] of Object.entries<any>(op.responses ?? {})) {
        if (!/^[45]/.test(String(code))) continue;
        if (r?.$ref) continue;
        const ct = r?.content?.['application/problem+json'] ?? r?.content?.['application/json'];
        if (!ct?.examples && !ct?.example) {
          missing.push(`${method.toUpperCase()} ${p} ${code}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('webhook catalogue has at least 8 events', () => {
    const webhooks = spec['x-webhooks'] ?? spec.webhooks ?? {};
    expect(Object.keys(webhooks).length).toBeGreaterThanOrEqual(8);
  });

  it('reusable examples library has the standard error set', () => {
    const ex = spec.components?.examples ?? {};
    for (const k of [
      'ErrorBadRequest', 'ErrorUnauthorized', 'ErrorForbidden', 'ErrorNotFound',
      'ErrorConflict', 'ErrorUnprocessable', 'ErrorRateLimited',
      'ErrorServer', 'ErrorUnavailable',
    ]) {
      expect(ex[k], `missing components.examples.${k}`).toBeTruthy();
    }
  });
});
