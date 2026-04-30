// @ts-nocheck — Node imports resolved by vitest, not app tsconfig
/**
 * CI Ratchet — every financial mutating operation MUST declare an
 * `Idempotency-Key` header parameter so safe retries are documented.
 *
 * Justification:
 *   - Stripe API Reference: "All POST requests accept idempotency keys"
 *   - PSD2 RTS Article 36(1)(b): payment initiation services must support
 *     deterministic retry semantics for failed transmissions.
 *   - Project Core Memory: "UUID v4 idempotency_key and row-level locks
 *     (FOR UPDATE) are mandatory for atomic financial transactions."
 *
 * Standing Order #2 (The Ratchet): once an op declares Idempotency-Key, it
 * cannot quietly drop the parameter without bumping a major API version.
 *
 * Scope: tags considered "financial" (money-mover or critical money state).
 * Non-financial mutations (auth/OTP, parsing, captcha, validation) are out
 * of scope because they have no money side-effect.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

const FINANCIAL_TAGS = new Set([
  'Payment Gateway',
  'Payments',
  'Mobile Money',
  'Pay by Bank',
  'PISP',
  'Interbank',
  'Loans',
  'Savings',
  'Overdraft',
  'Virtual Cards',
  'Ledger',
  'Banking Operations',
  'Payment Facilitation',
  'Settlement',
  'Consumer Tools',
]);

const MUT = ['post', 'put', 'patch'];

function hasIdempotency(op: any, pathItem: any): boolean {
  const merged = [...(pathItem.parameters || []), ...(op.parameters || [])];
  return merged.some((p) => {
    const ref = (p.$ref || '').toLowerCase();
    const name = (p.name || '').toLowerCase();
    return name === 'idempotency-key' || ref.includes('idempotency');
  });
}

describe('OpenAPI ratchet — Idempotency-Key on financial mutations', () => {
  it('every financial POST/PUT/PATCH declares Idempotency-Key', () => {
    const offenders: string[] = [];
    for (const [p, methods] of Object.entries<any>(spec.paths || {})) {
      for (const [m, op] of Object.entries<any>(methods)) {
        if (!MUT.includes(m)) continue;
        const tags: string[] = op.tags || [];
        if (!tags.some((t) => FINANCIAL_TAGS.has(t))) continue;
        if (!hasIdempotency(op, methods)) {
          offenders.push(`${m.toUpperCase()} ${p}  (tags: ${tags.join(',')})`);
        }
      }
    }
    expect(
      offenders,
      `Financial mutating ops missing Idempotency-Key:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('Idempotency-Key params declare a UUID-formatted string schema', () => {
    const violations: string[] = [];
    for (const [p, methods] of Object.entries<any>(spec.paths || {})) {
      for (const [m, op] of Object.entries<any>(methods)) {
        if (!MUT.includes(m)) continue;
        const merged = [...(methods.parameters || []), ...(op.parameters || [])];
        for (const param of merged) {
          // Resolve refs against components.parameters
          let resolved = param;
          if (param.$ref) {
            const refName = param.$ref.split('/').pop();
            resolved = spec.components?.parameters?.[refName] || param;
          }
          if ((resolved.name || '').toLowerCase() !== 'idempotency-key') continue;
          const sch = resolved.schema || {};
          const ok = sch.type === 'string' && (sch.format === 'uuid' || sch.pattern);
          if (!ok) violations.push(`${m.toUpperCase()} ${p}`);
        }
      }
    }
    expect(violations, `Idempotency-Key with non-UUID schema:\n  ${violations.join('\n  ')}`).toEqual([]);
  });
});
