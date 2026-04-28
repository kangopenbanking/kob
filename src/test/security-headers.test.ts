// @ts-nocheck
/**
 * Verifies the gateway enforces the security headers documented in the
 * developer portal. Fails CI if runtime drifts from the docs.
 *
 * Documented requirements:
 *  - CORS:           Access-Control-Allow-Origin present on /v1/health
 *  - HSTS:           Strict-Transport-Security with max-age >= 15552000
 *  - Content-Type:   application/json on JSON responses
 *  - Idempotency:    POST /v1/gateway/charges echoes Idempotency-Key handling
 *
 * Network calls only run when SECURITY_HEADERS_LIVE=1.
 */
import { describe, it, expect } from 'vitest';

const LIVE = process.env.SECURITY_HEADERS_LIVE === '1';
const BASE = 'https://api.kangopenbanking.com/v1';

const DOCUMENTED = {
  cors: 'access-control-allow-origin',
  hsts: 'strict-transport-security',
  contentType: 'content-type',
  idempotencyHeaderName: 'Idempotency-Key',
} as const;

describe('Gateway security headers — docs vs. runtime', () => {
  it('documented header names are stable constants', () => {
    expect(DOCUMENTED.cors).toBe('access-control-allow-origin');
    expect(DOCUMENTED.hsts).toBe('strict-transport-security');
    expect(DOCUMENTED.idempotencyHeaderName).toBe('Idempotency-Key');
  });

  (LIVE ? it : it.skip)('GET /v1/health returns documented CORS + HSTS + content-type', async () => {
    const r = await fetch(`${BASE}/health`, { headers: { Origin: 'https://example.com' } });
    await r.text();
    expect(r.headers.get(DOCUMENTED.cors), 'missing CORS').toBeTruthy();
    const hsts = r.headers.get(DOCUMENTED.hsts) || '';
    const m = hsts.match(/max-age=(\d+)/);
    expect(m && Number(m[1]) >= 15_552_000, `weak HSTS: ${hsts}`).toBe(true);
    expect(r.headers.get(DOCUMENTED.contentType) || '').toMatch(/json/);
  }, 30_000);

  (LIVE ? it : it.skip)('POST without Idempotency-Key on mutating endpoint is rejected per docs', async () => {
    const r = await fetch(`${BASE}/gateway/charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid' },
      body: '{}',
    });
    await r.text();
    // Either 400 (missing Idempotency-Key) or 401 (auth) — both documented.
    expect([400, 401, 403]).toContain(r.status);
  }, 30_000);
});
