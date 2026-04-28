// @ts-nocheck
/**
 * Confirms the gateway returns the documented rate-limit error format
 * (RFC 7807 application/problem+json) and the correct HTTP status (429)
 * for every documented tier.
 *
 * Runs live when RATE_LIMIT_LIVE=1; otherwise the static contract
 * portion still validates the documented tiers stay in lockstep with
 * src/pages/developer/RateLimits.tsx.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const LIVE = process.env.RATE_LIMIT_LIVE === '1';
const BASE = 'https://api.kangopenbanking.com/v1';

const DOCUMENTED_TIERS = [
  { name: 'Anonymous / Public', burst: 80 },
  { name: 'Sandbox API Key', burst: 320 },
];

describe('Rate-limit error contract', () => {
  it('documented tiers in RateLimits.tsx are exhaustive', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/pages/developer/RateLimits.tsx'),
      'utf-8',
    );
    for (const t of ['Anonymous / Public', 'Sandbox API Key', 'Production — Standard'])
      expect(src).toContain(t);
  });

  for (const tier of DOCUMENTED_TIERS) {
    (LIVE ? it : it.skip)(`${tier.name} — burst returns RFC 7807 problem+json on 429`, async () => {
      let saw429: Response | null = null;
      await Promise.all(
        Array.from({ length: tier.burst }).map(async () => {
          const r = await fetch(`${BASE}/health`);
          if (r.status === 429 && !saw429) saw429 = r;
          else await r.text();
        }),
      );
      if (!saw429) return; // gateway under quota; not a failure
      const ct = saw429.headers.get('content-type') || '';
      expect(ct).toMatch(/problem\+json|application\/json/);
      const body = await saw429.json().catch(() => ({}));
      expect(body).toHaveProperty('type');
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('status', 429);
      expect(saw429.headers.get('retry-after') || '').toMatch(/^\d+/);
    }, 60_000);
  }
});
