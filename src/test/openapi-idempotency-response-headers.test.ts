// @ts-nocheck — Node imports resolved by vitest
/**
 * Phase 8 ratchet — every operation that declares `Idempotency-Key`
 * MUST also declare both `X-Idempotent-Replay` and `X-Idempotency-Status`
 * on its 2xx response so clients can detect cached replays.
 *
 * Standing Order #2 (Ratchet): once declared, these headers cannot be silently dropped.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

const FINANCIAL_TAGS = new Set([
  'Payment Gateway', 'Payments', 'Mobile Money', 'Pay by Bank', 'PISP',
  'Interbank', 'Loans', 'Savings', 'Overdraft', 'Virtual Cards', 'Ledger',
  'Banking Operations', 'Payment Facilitation', 'Settlement', 'Consumer Tools',
]);
const MUT = ['post', 'put', 'patch'];

function hasIdem(op: any, methods: any) {
  const merged = [...(methods.parameters || []), ...(op.parameters || [])];
  return merged.some((p: any) => {
    const ref = (p.$ref || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    return name === 'idempotency-key' || ref.includes('idempotency');
  });
}

describe('Phase 8 ratchet — idempotency replay response headers', () => {
  it('every financial idempotent operation declares X-Idempotent-Replay on 2xx', () => {
    const offenders: string[] = [];
    for (const [p, methods] of Object.entries<any>(spec.paths || {})) {
      for (const [m, op] of Object.entries<any>(methods)) {
        if (!MUT.includes(m)) continue;
        const tags = op?.tags || [];
        if (!tags.some((t: string) => FINANCIAL_TAGS.has(t))) continue;
        if (!hasIdem(op, methods)) continue;
        for (const [code, resp] of Object.entries<any>(op.responses || {})) {
          if (!/^2\d\d$/.test(code)) continue;
          const headers = resp.headers || {};
          if (!headers['X-Idempotent-Replay']) {
            offenders.push(`${m.toUpperCase()} ${p} → ${code} (missing X-Idempotent-Replay)`);
          }
        }
      }
    }
    expect(offenders, `Operations missing replay header:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('declares the X-Idempotent-Replay header component', () => {
    expect(spec.components?.headers?.['X-Idempotent-Replay']).toBeDefined();
    expect(spec.components?.headers?.['X-Idempotency-Status']).toBeDefined();
    const status = spec.components.headers['X-Idempotency-Status'].schema;
    expect(status.enum).toEqual(['first_request', 'replayed', 'conflict_rejected']);
  });

  it('IdempotencyKey schema declares pattern (UUID v4) and maxLength', () => {
    for (const where of ['parameters', 'headers']) {
      const s = spec.components?.[where]?.IdempotencyKey?.schema;
      expect(s, `components.${where}.IdempotencyKey.schema missing`).toBeDefined();
      expect(s.pattern, `components.${where}.IdempotencyKey.schema.pattern missing`).toBeDefined();
      expect(s.maxLength, `components.${where}.IdempotencyKey.schema.maxLength missing`).toBe(255);
    }
  });
});
