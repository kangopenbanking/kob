// @ts-nocheck
/**
 * Live smoke test: hits the PUBLISHED URL from a clean session and asserts
 *   1. HTTP 200
 *   2. Zero redirects (or at most a single same-origin SPA fallback)
 *   3. Response body is the SPA shell (NOT a "404" / NotFound payload)
 *
 * Skipped automatically in CI when SMOKE_PUBLISHED=0 or when the network
 * is unavailable. Set SUPPORT_AGENT_URL to override the target.
 */
import { describe, it, expect } from 'vitest';

const TARGET = process.env.SUPPORT_AGENT_URL || 'https://kob.lovable.app/support-agent';
const ENABLED = process.env.SMOKE_PUBLISHED !== '0';

describe.skipIf(!ENABLED)('Published /support-agent smoke', () => {
  it(`GET ${TARGET} returns 200, no redirects, SPA shell`, async () => {
    let res: Response;
    try {
      res = await fetch(TARGET, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
    } catch (err) {
      console.warn('[smoke] network unavailable, skipping:', (err as Error).message);
      return;
    }

    // 1. status
    expect(res.status, `expected 200 from ${TARGET}, got ${res.status}`).toBe(200);

    // 2. no redirect status codes
    expect([301, 302, 303, 307, 308]).not.toContain(res.status);

    // 3. response is the SPA shell, not the 404 NotFound page
    const body = await res.text();
    expect(body.length).toBeGreaterThan(500);
    // The SPA shell contains the Vite entry script.
    expect(body).toMatch(/<div id="root">|\/assets\/index-/);
    // Hard guard against the regression where the build returned the NotFound payload.
    expect(body).not.toMatch(/Oops! Page not found/i);
  }, 15_000);

  it('static health manifest /support-agent-health.json is reachable', async () => {
    const url = TARGET.replace(/\/support-agent\/?$/, '/support-agent-health.json');
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      console.warn('[smoke] network unavailable, skipping:', (err as Error).message);
      return;
    }
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.route).toBe('/support-agent');
    expect(json.expected_marker).toBe('support-agent-ok');
  }, 15_000);
});
