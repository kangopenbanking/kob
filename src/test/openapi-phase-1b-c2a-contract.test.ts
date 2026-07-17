// @ts-nocheck
/**
 * Phase 1B-R1I-c.2A — Budgeting DELETE response contract guards.
 *
 * Justification:
 *   - Standing Order #2 (Ratchet): once the corrected response matrix is
 *     accepted, it may not silently regress.
 *   - Standing Order #4 (Surgeon Rule): additive-only; guards existence
 *     of new responses without asserting removal of anything.
 *
 * Scope: public/openapi.json only. No runtime code exercised.
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
  return (op.parameters || []).map((p: any) => (p.$ref ? p.$ref.split('/').pop() : p.name));
}
function resolveRef(ref: string): any {
  const parts = ref.replace(/^#\//, '').split('/');
  let cur: any = spec;
  for (const p of parts) cur = cur?.[p];
  return cur;
}
function responseBody(op: any, code: string) {
  const r = op.responses?.[code];
  if (!r) return null;
  return r.$ref ? resolveRef(r.$ref) : r;
}

const OPS = [
  { id: 'budgetingDeleteBudget', path: '/v1/budgeting/budgets/{budgetId}' },
  { id: 'budgetingDeleteCategory', path: '/v1/budgeting/categories/{categoryId}' },
];

describe('Phase 1B-R1I-c.2A — Budgeting DELETE response contract', () => {
  it('spec version pinned to 4.53.1 (unchanged by response correction)', () => {
    expect(spec.info.version).toBe('4.53.1');
  });

  it('operation count is 483 (post c.4 removal)', () => {
    let n = 0;
    for (const ms of Object.values<any>(spec.paths || {})) {
      for (const m of Object.keys(ms)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(m)) n++;
      }
    }
    expect(n).toBe(483);
  });

  for (const { id, path: opPath } of OPS) {
    describe(id, () => {
      it('exists at the expected path with DELETE method and unchanged operationId', () => {
        const f = findOp(id);
        expect(f).not.toBeNull();
        expect(f!.method).toBe('delete');
        expect(f!.path).toBe(opPath);
      });

      it('retains optional Idempotency-Key header (IdempotencyKeyHeader $ref)', () => {
        const f = findOp(id)!;
        expect(paramNames(f.op)).toContain('IdempotencyKeyHeader');
        const param = resolveRef('#/components/parameters/IdempotencyKeyHeader');
        expect(param.required).toBe(false);
        expect(param.name).toBe('Idempotency-Key');
        expect(param.schema.format).toBe('uuid');
      });

      it.each(['204', '400', '401', '404', '409', '500'] as const)('documents %s', (code) => {
        const f = findOp(id)!;
        expect(Object.keys(f.op.responses)).toContain(code);
      });

      it('every 4xx/5xx response uses application/problem+json with ProblemDetails schema', () => {
        const f = findOp(id)!;
        for (const code of Object.keys(f.op.responses)) {
          if (!/^[45]\d\d$/.test(code)) continue;
          const body = responseBody(f.op, code);
          const media = body?.content?.['application/problem+json'];
          expect(media, `${id} ${code} missing application/problem+json`).toBeTruthy();
          const schema = media.schema;
          const ref = schema.$ref || schema.allOf?.[0]?.$ref;
          expect(ref, `${id} ${code} missing ProblemDetails ref`).toBeTruthy();
          expect(ref).toMatch(/ProblemDetails/);
        }
      });

      it('all response $refs resolve', () => {
        const f = findOp(id)!;
        for (const [code, r] of Object.entries<any>(f.op.responses)) {
          if (r.$ref) {
            expect(resolveRef(r.$ref), `${id} ${code} $ref unresolved`).toBeTruthy();
          }
        }
      });

      it('409 documents idempotency-key reuse conflict', () => {
        const f = findOp(id)!;
        const body = responseBody(f.op, '409');
        const desc = (body?.description || '').toString();
        expect(desc).toMatch(/IDEMPOTENCY_KEY_REUSED/);
      });

      it('404 description masks ownership/tenant boundaries', () => {
        const f = findOp(id)!;
        const opDesc = (f.op.description || '').toString();
        expect(opDesc).toMatch(/intentionally concealed|ownership|tenant/i);
      });

      it('description does not claim physical deletion or restore capability', () => {
        const f = findOp(id)!;
        const desc = (f.op.description || '').toString().toLowerCase();
        // Reject affirmative physical-delete claims; explicit "not physically deleted" wording is allowed.
        expect(desc).not.toMatch(/\bis physically (deleted|removed)/);
        expect(desc).not.toMatch(/\bpermanently (deleted|removed|erased)/);
        expect(desc).not.toMatch(/\bcan be restored\b/);
        expect(desc).not.toMatch(/\brestore endpoint\b/);
      });
    });
  }

  describe('budgetingDeleteCategory — protected/dependency conflicts', () => {
    it('409 documents SYSTEM_CATEGORY_PROTECTED', () => {
      const body = responseBody(findOp('budgetingDeleteCategory')!.op, '409');
      const desc = (body?.description || '').toString();
      expect(desc).toMatch(/SYSTEM_CATEGORY_PROTECTED/);
    });
    it('409 documents CATEGORY_HAS_ACTIVE_DEPENDENCIES', () => {
      const body = responseBody(findOp('budgetingDeleteCategory')!.op, '409');
      const desc = (body?.description || '').toString();
      expect(desc).toMatch(/CATEGORY_HAS_ACTIVE_DEPENDENCIES/);
    });
    it('409 examples include the two conflict cases + idempotency reuse', () => {
      const body = responseBody(findOp('budgetingDeleteCategory')!.op, '409');
      const examples = body?.content?.['application/problem+json']?.examples || {};
      expect(examples.system_category_protected?.$ref).toBe('#/components/examples/ProblemDetailsSystemCategoryProtected');
      expect(examples.category_has_active_dependencies?.$ref).toBe('#/components/examples/ProblemDetailsCategoryActiveDependencies');
      expect(examples.idempotency_key_reused?.$ref).toBeTruthy();
    });
  });

  describe('reusable Problem Details examples exist', () => {
    it.each([
      'ProblemDetailsValidation',
      'ProblemDetailsConflict',
      'ProblemDetailsInvalidIdempotencyKey',
      'ProblemDetailsIdempotencyKeyReused',
      'ProblemDetailsSystemCategoryProtected',
      'ProblemDetailsCategoryActiveDependencies',
    ])('components.examples.%s is present', (name) => {
      expect(spec.components?.examples?.[name]).toBeTruthy();
    });
  });
});
