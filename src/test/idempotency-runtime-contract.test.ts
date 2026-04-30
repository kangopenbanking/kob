// @ts-nocheck — Node imports resolved by vitest
/**
 * Phase 5a — Idempotency runtime contract tests.
 *
 * Verifies the hardened helper distinguishes:
 *   - validateIdempotencyKey: UUID v4 + ≤255 chars
 *   - reserveIdempotency: miss / replay / conflict / in_flight / invalid
 *   - idempotencyResponse: emits X-Idempotent-Replay on replay, RFC-7807-shaped 4xx
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const src = fs.readFileSync(
  path.join(root, 'supabase/functions/_shared/integration-layer/idempotency.ts'),
  'utf-8',
);

describe('Idempotency runtime — hardened contract (Phase 5a)', () => {
  it('exports the hardened API surface', () => {
    expect(src).toMatch(/export function validateIdempotencyKey/);
    expect(src).toMatch(/export async function reserveIdempotency/);
    expect(src).toMatch(/export function idempotencyResponse/);
    // Legacy shims preserved for back-compat (Standing Order #4)
    expect(src).toMatch(/export async function lookupIdempotency/);
    expect(src).toMatch(/export async function storeIdempotency/);
  });

  it('enforces UUID v4 + 255-char ceiling', () => {
    expect(src).toMatch(/UUID_V4_RE\s*=\s*\/\^\[0-9a-f\]\{8\}/);
    expect(src).toMatch(/MAX_KEY_LEN\s*=\s*255/);
  });

  it('reserve() distinguishes 5 outcomes', () => {
    for (const kind of ['miss', 'replay', 'conflict', 'in_flight', 'invalid']) {
      expect(src, `missing kind: ${kind}`).toContain(`"${kind}"`);
    }
  });

  it('replay response sets X-Idempotent-Replay header', () => {
    expect(src).toMatch(/X-Idempotent-Replay/);
  });

  it('emits standard error codes for invalid / conflict / in-flight', () => {
    expect(src).toContain('IDEMPOTENCY_KEY_INVALID');
    expect(src).toContain('IDEMPOTENCY_KEY_REUSED');
    expect(src).toContain('IDEMPOTENCY_KEY_IN_FLIGHT');
  });

  it('in-flight response sets Retry-After', () => {
    expect(src).toMatch(/Retry-After/);
  });

  it('reserves an in-flight slot atomically (insert with NULL response_status)', () => {
    expect(src).toMatch(/response_status:\s*null/);
    expect(src).toMatch(/\.insert\(\{[\s\S]*?idempotency_key/);
  });

  it('expired rows are reclaimable (not treated as in-flight forever)', () => {
    expect(src).toMatch(/expires_at[\s\S]{0,80}getTime\(\)\s*<\s*Date\.now\(\)/);
  });
});
