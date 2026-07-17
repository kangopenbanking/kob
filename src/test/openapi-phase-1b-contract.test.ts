// @ts-nocheck
/**
 * Phase 1B contract tests — surgical guards for the 16 affected operations.
 *
 * Justification:
 *   - Standing Order #2 (Ratchet): once G1/G3/G4/G7 hit zero for these ops,
 *     they cannot silently regress.
 *   - Standing Order #4 (Surgeon Rule): Idempotency-Key added as OPTIONAL
 *     on existing v1 operations (§6.1 backward compatibility).
 *
 * Scope: public/openapi.json only.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

function findOp(id: string) {
  for (const [p, ms] of Object.entries<any>(spec.paths || {})) {
    for (const [m, o] of Object.entries<any>(ms)) {
      if (o && typeof o === 'object' && o.operationId === id) return { path: p, method: m, op: o };
    }
  }
  return null;
}
function paramNames(op: any): string[] {
  return (op.parameters || []).map((p: any) =>
    p.$ref ? p.$ref.split('/').pop() : p.name,
  );
}
function hasIdempotency(op: any) {
  return paramNames(op).some(
    (n) => n === 'IdempotencyKey' || n === 'IdempotencyKeyHeader' ||
      (typeof n === 'string' && n.toLowerCase() === 'idempotency-key'),
  );
}

describe('Phase 1B — OpenAPI contract guards', () => {
  it('optional IdempotencyKeyHeader component exists with UUID v4 shape and required=false', () => {
    const c = spec.components?.parameters?.IdempotencyKeyHeader;
    expect(c).toBeTruthy();
    expect(c.in).toBe('header');
    expect(c.name).toBe('Idempotency-Key');
    expect(c.required).toBe(false);
    expect(c.schema.type).toBe('string');
    expect(c.schema.format).toBe('uuid');
    expect(c.schema.pattern).toBeTruthy();
  });

  it('AgentTransactionResponse schema exists and is properly typed', () => {
    const s = spec.components?.schemas?.AgentTransactionResponse;
    expect(s).toBeTruthy();
    expect(s.type).toBe('object');
    for (const f of ['transaction_id','agent_id','type','amount','currency','status','balance_after','created_at']) {
      expect(s.required).toContain(f);
    }
  });

  const G1 = ['agentFloatTopup','agentFloatWithdraw','agentCashIn','agentCashOut'];
  for (const id of G1) {
    it(`G1 ${id} — 200 references AgentTransactionResponse`, () => {
      const found = findOp(id)!;
      const sch = found.op.responses?.['200']?.content?.['application/json']?.schema;
      expect(sch?.$ref).toBe('#/components/schemas/AgentTransactionResponse');
    });
  }

  // niumIncomingWebhook is intentionally excluded from this list post a.3C:
  // it uses provider-event idempotency (x-kob-idempotency / x-kob-webhook)
  // instead of a generic client Idempotency-Key header. See
  // src/test/nium-webhook-contract-reconciliation.test.ts for its dedicated guards.
  const G3 = ['qrCreate','createGlobalAccount','updateGlobalAccountPayoutPreference'];
  for (const id of G3) {
    it(`G3 ${id} — declares Idempotency-Key header`, () => {
      const found = findOp(id)!;
      expect(hasIdempotency(found.op)).toBe(true);
    });
  }

  // Phase 1B-R1I-c.4: budgetingDeleteRule removed from the unreleased 4.53.1
  // contract (no runtime handler; no backing category_rules table).
  const G7 = ['budgetingDeleteBudget','budgetingDeleteCategory','budgetingDeleteGoal','budgetingDisableRoundUp'];
  for (const id of G7) {
    it(`G7 ${id} — DELETE declares Idempotency-Key header (optional, backward compatible)`, () => {
      const found = findOp(id)!;
      expect(found.method).toBe('delete');
      expect(hasIdempotency(found.op)).toBe(true);
      // Must reference the optional variant so legacy clients omitting the header still work.
      const refs = paramNames(found.op);
      expect(refs).toContain('IdempotencyKeyHeader');
    });
  }

  const G4 = ['agentList','cemacCorridorsList','listGlobalAccounts'];
  for (const id of G4) {
    it(`G4 ${id} — declares cursor + limit pagination parameters`, () => {
      const found = findOp(id)!;
      const names = paramNames(found.op);
      const hasCursor = names.some((n) => ['CursorParam','StartingAfter','EndingBefore','cursor','starting_after','ending_before'].includes(n));
      const hasLimit = names.some((n) => n === 'LimitParam' || n === 'limit' || n === 'PageParam');
      expect(hasCursor, `${id} missing cursor param`).toBe(true);
      expect(hasLimit, `${id} missing limit param`).toBe(true);
    });
  }

  it('operation count is preserved (Standing Order #1 — The Lock)', () => {
    let n = 0;
    for (const ms of Object.values<any>(spec.paths || {})) {
      for (const m of Object.keys(ms)) {
        if (['get','post','put','patch','delete'].includes(m)) n++;
      }
    }
    expect(n).toBe(483);
  });

  it('info.version bumped to 4.53.1 (Standing Order #6 — Version Gate)', () => {
    expect(spec.info.version).toBe('4.53.1');
  });
});
