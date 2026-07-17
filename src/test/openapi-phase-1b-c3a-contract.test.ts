/**
 * Phase 1B-R1I-c.3A — Goal archive & round-up disable response contract guards.
 *
 * Standing Orders cited:
 *  - #2 Ratchet: once the corrected response matrix is accepted, it may not
 *    silently regress.
 *  - #4 Surgeon: additive-only; asserts presence, not removal.
 *
 * Scope: public/openapi.json only. No runtime code exercised.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];
type JsonObject = { [k: string]: JsonValue };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8')) as JsonObject;

const paths = spec.paths as JsonObject;
const components = spec.components as JsonObject;

function isObject(v: JsonValue): v is JsonObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function findOp(id: string): { path: string; method: string; op: JsonObject } | null {
  for (const [p, msVal] of Object.entries(paths)) {
    if (!isObject(msVal)) continue;
    for (const [m, oVal] of Object.entries(msVal)) {
      if (isObject(oVal) && oVal.operationId === id) {
        return { path: p, method: m, op: oVal };
      }
    }
  }
  return null;
}

function paramRefNames(op: JsonObject): string[] {
  const params = op.parameters;
  if (!Array.isArray(params)) return [];
  const out: string[] = [];
  for (const p of params) {
    if (!isObject(p)) continue;
    const ref = p.$ref;
    if (typeof ref === 'string') {
      const tail = ref.split('/').pop();
      if (tail) out.push(tail);
    } else if (typeof p.name === 'string') {
      out.push(p.name);
    }
  }
  return out;
}

function resolveRef(ref: string): JsonValue | undefined {
  const parts = ref.replace(/^#\//, '').split('/');
  let cur: JsonValue = spec;
  for (const p of parts) {
    if (!isObject(cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

function responseBody(op: JsonObject, code: string): JsonObject | null {
  const responses = op.responses;
  if (!isObject(responses)) return null;
  const r = responses[code];
  if (!isObject(r)) return null;
  const ref = r.$ref;
  if (typeof ref === 'string') {
    const resolved = resolveRef(ref);
    return isObject(resolved) ? resolved : null;
  }
  return r;
}

function problemJsonExamples(r: JsonObject): JsonObject | null {
  const content = r.content;
  if (!isObject(content)) return null;
  const media = content['application/problem+json'];
  if (!isObject(media)) return null;
  const examples = media.examples;
  return isObject(examples) ? examples : null;
}

function problemJsonSchemaRef(r: JsonObject): string | null {
  const content = r.content;
  if (!isObject(content)) return null;
  const media = content['application/problem+json'];
  if (!isObject(media)) return null;
  const schema = media.schema;
  if (!isObject(schema)) return null;
  return typeof schema.$ref === 'string' ? schema.$ref : null;
}

const OPS: Array<{ id: string; path: string }> = [
  { id: 'budgetingDeleteGoal', path: '/v1/budgeting/goals/{goalId}' },
  { id: 'budgetingDisableRoundUp', path: '/v1/budgeting/goals/{goalId}/round-up' },
];

describe('Phase 1B-R1I-c.3A — Goal & round-up DELETE response contract', () => {
  it('spec version pinned to 4.53.1 (unchanged by response correction)', () => {
    expect((spec.info as JsonObject).version).toBe('4.53.1');
  });

  it('operation count remains 484', () => {
    let n = 0;
    for (const ms of Object.values(paths)) {
      if (!isObject(ms)) continue;
      for (const m of Object.keys(ms)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(m)) n++;
      }
    }
    expect(n).toBe(484);
  });

  it('reusable Problem Details components exist', () => {
    const schemas = components.schemas as JsonObject;
    const responses = components.responses as JsonObject;
    const examples = components.examples as JsonObject;
    expect(schemas.ProblemDetails).toBeDefined();
    for (const r of ['Unauthorized', 'NotFound', 'TooManyRequests', 'InternalServerError']) {
      expect(responses[r], `missing response ${r}`).toBeDefined();
    }
    for (const e of [
      'ProblemDetailsValidation',
      'ProblemDetailsConflict',
      'ProblemDetailsIdempotencyKeyReused',
      'ProblemDetailsInvalidIdempotencyKey',
      'ProblemDetailsGoalHasPendingFinancialOperations',
      'ProblemDetailsGoalStateConflict',
      'ProblemDetailsRoundupHasPendingInstructions',
      'ProblemDetailsRoundupStateConflict',
    ]) {
      expect(examples[e], `missing example ${e}`).toBeDefined();
    }
  });

  for (const { id, path: p } of OPS) {
    describe(`${id} @ DELETE ${p}`, () => {
      const found = findOp(id);
      it('exists at the documented path with method DELETE', () => {
        expect(found).not.toBeNull();
        expect(found?.path).toBe(p);
        expect(found?.method).toBe('delete');
      });
      it('retains optional Idempotency-Key parameter', () => {
        const names = paramRefNames(found!.op);
        expect(names.some((n) => /IdempotencyKey/i.test(n))).toBe(true);
      });
      it('documents 204, 400, 401, 404, 409, 429, 500', () => {
        const responses = found!.op.responses as JsonObject;
        for (const code of ['204', '400', '401', '404', '409', '429', '500']) {
          expect(responses[code], `missing ${code}`).toBeDefined();
        }
      });
      it('204 has no response body', () => {
        const r204 = (found!.op.responses as JsonObject)['204'] as JsonObject;
        expect(r204.content).toBeUndefined();
      });
      it('403 is intentionally omitted (masked 404 used for isolation)', () => {
        const responses = found!.op.responses as JsonObject;
        expect(responses['403']).toBeUndefined();
      });
      it('400 uses ProblemDetails schema with invalid_idempotency_key example', () => {
        const r = responseBody(found!.op, '400');
        expect(r).not.toBeNull();
        expect(problemJsonSchemaRef(r!)).toBe('#/components/schemas/ProblemDetails');
        expect(problemJsonExamples(r!)?.invalid_idempotency_key).toBeDefined();
      });
      it('401/404/429/500 reuse canonical response components', () => {
        const responses = found!.op.responses as JsonObject;
        expect((responses['401'] as JsonObject).$ref).toBe('#/components/responses/Unauthorized');
        expect((responses['404'] as JsonObject).$ref).toBe('#/components/responses/NotFound');
        expect((responses['429'] as JsonObject).$ref).toBe('#/components/responses/TooManyRequests');
        expect((responses['500'] as JsonObject).$ref).toBe('#/components/responses/InternalServerError');
      });
      it('409 uses ProblemDetails schema and idempotency_key_reused example', () => {
        const r = responseBody(found!.op, '409');
        expect(r).not.toBeNull();
        expect(problemJsonSchemaRef(r!)).toBe('#/components/schemas/ProblemDetails');
        expect(problemJsonExamples(r!)?.idempotency_key_reused).toBeDefined();
      });
      it('all $ref pointers resolve', () => {
        function walk(node: JsonValue): void {
          if (!isObject(node)) {
            if (Array.isArray(node)) node.forEach(walk);
            return;
          }
          const ref = node.$ref;
          if (typeof ref === 'string') {
            expect(resolveRef(ref), `dangling $ref ${ref}`).toBeDefined();
          }
          for (const v of Object.values(node)) walk(v);
        }
        walk(found!.op as JsonValue);
      });
    });
  }

  it('204 descriptions declare terminal-state replay semantics', () => {
    for (const { id } of OPS) {
      const responses = findOp(id)!.op.responses as JsonObject;
      const desc = (responses['204'] as JsonObject).description;
      expect(String(desc)).toMatch(/idempotent terminal-state replay|already/i);
    }
  });

  it('budgetingDeleteGoal documents unresolved financial conflict (GOAL_HAS_PENDING_FINANCIAL_OPERATIONS)', () => {
    const op = findOp('budgetingDeleteGoal')!.op;
    const r = responseBody(op, '409');
    expect(problemJsonExamples(r!)?.goal_has_pending_financial_operations).toBeDefined();
    expect(String(op.description)).toMatch(/GOAL_HAS_PENDING_FINANCIAL_OPERATIONS/);
    expect(String(op.description)).toMatch(/GOAL_STATE_CONFLICT/);
  });

  it('budgetingDeleteGoal description does not claim physical deletion or financial reversal', () => {
    const d = String(findOp('budgetingDeleteGoal')!.op.description);
    expect(d).not.toMatch(/\bphysically deletes\b/i);
    expect(d).toMatch(/not physically deleted/i);
    expect(d).toMatch(/no automatic (?:refund|reversal|cancellation)/i);
    expect(d).toMatch(/preserved/i);
  });

  it('budgetingDisableRoundUp documents disable semantics and pending-instruction conflict', () => {
    const op = findOp('budgetingDisableRoundUp')!.op;
    const r = responseBody(op, '409');
    expect(problemJsonExamples(r!)?.roundup_has_pending_instructions).toBeDefined();
    expect(String(op.description)).toMatch(/ROUNDUP_HAS_PENDING_INSTRUCTIONS/);
    expect(String(op.description)).toMatch(/ROUNDUP_STATE_CONFLICT/);
    expect(String(op.description)).toMatch(/disabl/i);
  });

  it('budgetingDisableRoundUp description does not claim cancellation, reversal or history deletion', () => {
    const d = String(findOp('budgetingDisableRoundUp')!.op.description);
    expect(d).toMatch(/not implicitly cancelled/i);
    expect(d).toMatch(/preserved/i);
    expect(d).not.toMatch(/\b(?:deletes|removes)\s+(?:round-up )?transactions?\b/i);
  });

  it('descriptions state masked 404 semantics for ownership/tenant isolation', () => {
    for (const { id } of OPS) {
      const d = String(findOp(id)!.op.description);
      expect(d).toMatch(/intentionally concealed|outside the authenticated caller/i);
    }
  });

  it('IdempotencyKeyHeader parameter remains optional (required !== true)', () => {
    const param = resolveRef('#/components/parameters/IdempotencyKeyHeader');
    expect(isObject(param) && param.required === true).toBe(false);
  });

  it('budgetingDeleteRule removed by Phase 1B-R1I-c.4 (never released; no runtime; no backing table)', () => {
    const rule = findOp('budgetingDeleteRule');
    expect(rule).toBeNull();
  });
});
