// Phase 1B-R1I-c.2B-V — lint clean (no ts-nocheck; pure string assertions).
/**
 * Phase 1B-R1I-c.2B — Shared idempotency helper 204 No Content support.
 *
 * Source-level assertions (matching the project's shared-helper test
 * convention in `idempotency-runtime-contract.test.ts`) that prove:
 *   - bodyless statuses are recognised explicitly (204/205/304);
 *   - `storeIdempotency` normalises the persisted body to null for 204;
 *   - `reserveIdempotency` returns `hasBody:false` for a stored 204;
 *   - `idempotencyResponse` replay for a bodyless status emits
 *     `new Response(null, ...)` with NO `Content-Type`;
 *   - JSON replay behaviour is unchanged for non-bodyless statuses.
 *
 * Runtime E2E for the persistence path lives with the Deno function tests
 * (integration-layer + nium callers) which continue to exercise 200/201/409.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const src = fs.readFileSync(
  path.join(root, 'supabase/functions/_shared/integration-layer/idempotency.ts'),
  'utf-8',
);

describe('Idempotency — 204 No Content bodyless support (Phase 1B-R1I-c.2B)', () => {
  it('exports an explicit bodyless-status discriminator', () => {
    expect(src).toMatch(/export function isBodylessStatus\(status: number\): boolean/);
    // RFC 9110: 204, 205, 304 MUST NOT include a message body.
    expect(src).toMatch(/status === 204 \|\| status === 205 \|\| status === 304/);
  });

  it('IdempotencyHit carries an explicit hasBody discriminator (no truthiness checks)', () => {
    expect(src).toMatch(/kind: "replay";[\s\S]{0,400}hasBody: boolean;/);
  });

  it('reserveIdempotency() sets hasBody from the stored status', () => {
    expect(src).toMatch(/const hasBody = !isBodylessStatus\(status\)/);
    expect(src).toMatch(/kind: "replay", status, body: hasBody \? existing\.response_body : null, hasBody/);
  });

  it('storeIdempotency() normalises the persisted body to null for bodyless statuses', () => {
    expect(src).toMatch(/const bodyless = isBodylessStatus\(args\.status\)/);
    expect(src).toMatch(/const persistedBody = bodyless \? null : \(args\.body \?\? null\)/);
    expect(src).toMatch(/response_body: persistedBody as Record<string, unknown> \| null/);
  });

  it('idempotencyResponse() bodyless replay: Response(null), no Content-Type, X-Idempotent-Replay only', () => {
    // Must branch on hasBody, not on body truthiness (valid JSON bodies may be null/false/0/""/[]/{}).
    expect(src).toMatch(/if \(!result\.hasBody\) \{[\s\S]{0,300}new Response\(null, \{[\s\S]{0,200}"X-Idempotent-Replay": "true"/);
    // The bodyless branch must NOT emit a JSON content type.
    const bodylessBlock = src.split(/if \(!result\.hasBody\) \{/)[1]?.split(/\}\s*return new Response\(JSON\.stringify/)[0] ?? '';
    expect(bodylessBlock).not.toMatch(/application\/json/);
    expect(bodylessBlock).not.toMatch(/application\/problem\+json/);
    expect(bodylessBlock).not.toMatch(/Content-Length/);
  });

  it('JSON replay path is preserved for non-bodyless statuses (compatibility)', () => {
    expect(src).toMatch(/return new Response\(JSON\.stringify\(result\.body\), \{[\s\S]{0,300}"Content-Type": "application\/json", "X-Idempotent-Replay": "true"/);
  });

  it('conflict, invalid and in-flight envelopes still emit JSON (unchanged)', () => {
    expect(src).toMatch(/IDEMPOTENCY_KEY_INVALID/);
    expect(src).toMatch(/IDEMPOTENCY_KEY_REUSED/);
    expect(src).toMatch(/IDEMPOTENCY_KEY_IN_FLIGHT/);
    expect(src).toMatch(/"Retry-After": "2"/);
  });

  it('compatibility guard: helper does not rely on ambiguous truthiness `if (body)`', () => {
    // Prohibited pattern from the mandate §5: `if (body) { ... }` in the replay path.
    // The bodyless branch must be status-driven via hasBody.
    const replayRegion = src.match(/if \(result\.kind === "replay"\)[\s\S]{0,1500}/)?.[0] ?? '';
    expect(replayRegion).not.toMatch(/if\s*\(\s*result\.body\s*\)\s*\{/);
    expect(replayRegion).not.toMatch(/if\s*\(\s*body\s*\)\s*\{/);
  });
});
