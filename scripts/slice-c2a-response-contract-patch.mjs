#!/usr/bin/env node
/**
 * Phase 1B-R1I-c.2A — Budgeting DELETE response contract correction.
 *
 * Additive-only. Adds 400/401/404/409/429/500 to:
 *   - budgetingDeleteBudget   (DELETE /v1/budgeting/budgets/{budgetId})
 *   - budgetingDeleteCategory (DELETE /v1/budgeting/categories/{categoryId})
 *
 * Uses existing reusable Problem Details responses. Adds two new
 * components.examples entries (SystemCategoryProtected, CategoryActiveDependencies)
 * referenced by the category op's 409. Preserves version 4.53.1, operation
 * count 484. Regenerates YAML from the updated JSON.
 *
 * Justification:
 *   - Ratified c.0A semantics require documenting archive/soft-delete outcomes
 *     with truthful error responses (auth, ownership isolation, system-cat
 *     protection, active-dependency conflict, idempotency conflict).
 *   - Standing Order #4 (Surgeon Rule): additive-only; no operation/schema
 *     removal, no renames.
 *   - Standing Order #6 (Version Gate): patch-only additive to Unreleased
 *     contract; version unchanged (4.53.1 → 4.53.1).
 *   - Standing Order #2 (Ratchet): improves G6 by adding 409+429 to two
 *     mutations without weakening any other gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const JSON_PATH = path.join(ROOT, 'public/openapi.json');
const YAML_PATH = path.join(ROOT, 'public/openapi.yaml');

const spec = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// --- Guardrails ---------------------------------------------------------
if (spec.info?.version !== '4.53.1') {
  throw new Error(`Expected version 4.53.1, got ${spec.info?.version}`);
}
const opCountBefore = (() => {
  let n = 0;
  for (const ms of Object.values(spec.paths || {})) {
    for (const m of Object.keys(ms)) {
      if (['get','post','put','patch','delete'].includes(m)) n++;
    }
  }
  return n;
})();
if (opCountBefore !== 484) {
  throw new Error(`Expected 484 operations, got ${opCountBefore}`);
}

// --- Add two new Problem Details examples (category-specific) -----------
spec.components.examples = spec.components.examples || {};

spec.components.examples.ProblemDetailsSystemCategoryProtected = {
  summary: 'Protected system category cannot be soft-deleted',
  value: {
    type: 'https://api.kangopenbanking.com/errors/system-category-protected',
    title: 'System Category Protected',
    status: 409,
    detail: 'The requested category is a system-managed category and cannot be soft-deleted.',
    instance: '/v1/budgeting/categories/00000000-0000-4000-8000-000000000000',
    code: 'SYSTEM_CATEGORY_PROTECTED',
    error_id: 'err_syscat_a1b2c3',
    timestamp: '2026-07-16T10:00:00Z',
  },
};

spec.components.examples.ProblemDetailsCategoryActiveDependencies = {
  summary: 'Category has active dependencies preventing soft-deletion',
  value: {
    type: 'https://api.kangopenbanking.com/errors/category-has-active-dependencies',
    title: 'Category Has Active Dependencies',
    status: 409,
    detail: 'The category cannot be soft-deleted because active dependent resources still reference it.',
    instance: '/v1/budgeting/categories/00000000-0000-4000-8000-000000000000',
    code: 'CATEGORY_HAS_ACTIVE_DEPENDENCIES',
    error_id: 'err_catdep_a1b2c3',
    timestamp: '2026-07-16T10:00:00Z',
  },
};

spec.components.examples.ProblemDetailsIdempotencyKeyReused = spec.components.examples.ProblemDetailsIdempotencyKeyReused || {
  summary: 'Idempotency key reused with a different request body',
  value: {
    type: 'https://api.kangopenbanking.com/errors/idempotency-key-reused',
    title: 'Idempotency Key Conflict',
    status: 409,
    detail: 'The provided Idempotency-Key was previously used with a different request body.',
    instance: '/v1/budgeting/budgets/00000000-0000-4000-8000-000000000000',
    code: 'IDEMPOTENCY_KEY_REUSED',
    error_id: 'err_idem_a1b2c3',
    timestamp: '2026-07-16T10:00:00Z',
  },
};

spec.components.examples.ProblemDetailsInvalidIdempotencyKey = spec.components.examples.ProblemDetailsInvalidIdempotencyKey || {
  summary: 'Malformed Idempotency-Key header',
  value: {
    type: 'https://api.kangopenbanking.com/errors/invalid-idempotency-key',
    title: 'Invalid Idempotency Key',
    status: 400,
    detail: 'The Idempotency-Key header value is not a valid UUID v4.',
    instance: '/v1/budgeting/budgets/00000000-0000-4000-8000-000000000000',
    code: 'INVALID_IDEMPOTENCY_KEY',
    error_id: 'err_iik_a1b2c3',
    timestamp: '2026-07-16T10:00:00Z',
  },
};

// --- Helpers ------------------------------------------------------------
function findOp(operationId) {
  for (const [p, ms] of Object.entries(spec.paths || {})) {
    for (const [m, o] of Object.entries(ms)) {
      if (o && typeof o === 'object' && o.operationId === operationId) {
        return { path: p, method: m, op: o };
      }
    }
  }
  return null;
}

function makeConflictResponse({ opDescription, extraExampleRefs = {} }) {
  const examples = {
    default: { $ref: '#/components/examples/ProblemDetailsConflict' },
    idempotency_key_reused: { $ref: '#/components/examples/ProblemDetailsIdempotencyKeyReused' },
    ...extraExampleRefs,
  };
  return {
    description: opDescription,
    headers: {},
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetails' },
        examples,
      },
    },
  };
}

function makeBadRequestResponse(opDescription) {
  return {
    description: opDescription,
    headers: {},
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetails' },
        examples: {
          default: { $ref: '#/components/examples/ProblemDetailsValidation' },
          invalid_idempotency_key: { $ref: '#/components/examples/ProblemDetailsInvalidIdempotencyKey' },
        },
      },
    },
  };
}

function patchOp({ operationId, description204, description404, description400, description409, extra409Examples = {} }) {
  const found = findOp(operationId);
  if (!found) throw new Error(`Operation not found: ${operationId}`);
  const op = found.op;

  // Clarify 204 description (truthful semantics)
  op.responses['204'].description = description204;

  op.responses['400'] = makeBadRequestResponse(description400);
  op.responses['401'] = { $ref: '#/components/responses/Unauthorized' };
  op.responses['404'] = {
    description: description404,
    headers: {},
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetails' },
        examples: { default: { $ref: '#/components/examples/ProblemDetailsValidation' } },
      },
    },
  };
  // Rebuild 404 using canonical NotFound $ref (keeps parity with other ops).
  op.responses['404'] = { $ref: '#/components/responses/NotFound' };
  op.responses['409'] = makeConflictResponse({
    opDescription: description409,
    extraExampleRefs: extra409Examples,
  });
  op.responses['429'] = { $ref: '#/components/responses/TooManyRequests' };
  op.responses['500'] = { $ref: '#/components/responses/InternalServerError' };

  // Extend operation description with truthful semantics + 404 masking note.
  const semanticsNote = op.operationId === 'budgetingDeleteBudget'
    ? 'Archives the budget. The budget is not physically deleted; historical spending remains intact. Returns 204 on the first successful transition, on a valid same-key idempotent replay, and when the budget is already in the archived terminal state (no repeated mutation, audit event or notification is emitted). 404 is returned when the budget does not exist OR when it exists but lies outside the authenticated caller\'s authoritative scope (ownership/tenant boundaries are intentionally concealed).'
    : 'Soft-deletes an eligible user category. The category is not physically removed; historical transactions retain their category linkage. Returns 204 on the first successful transition, on a valid same-key idempotent replay, and when the category is already in the soft-deleted terminal state (no repeated mutation, audit event or notification is emitted). 404 is returned when the category does not exist OR when it exists but lies outside the authenticated caller\'s authoritative scope (ownership/tenant boundaries are intentionally concealed). System-managed categories cannot be soft-deleted (409 SYSTEM_CATEGORY_PROTECTED). Categories with active dependencies cannot be soft-deleted (409 CATEGORY_HAS_ACTIVE_DEPENDENCIES).';

  op.description = semanticsNote;
}

patchOp({
  operationId: 'budgetingDeleteBudget',
  description204: 'Budget archived, or already archived (idempotent terminal-state replay). No response body.',
  description400: 'Malformed budget identifier or malformed Idempotency-Key header (INVALID_RESOURCE_ID, INVALID_IDEMPOTENCY_KEY).',
  description404: 'Budget not found, or budget exists outside the caller\'s authoritative scope (ownership/tenant boundaries are intentionally concealed).',
  description409: 'Idempotency conflict (IDEMPOTENCY_KEY_REUSED when the same key is reused with a changed request body; IDEMPOTENCY_REQUEST_IN_PROGRESS for a concurrent same-key request).',
});

patchOp({
  operationId: 'budgetingDeleteCategory',
  description204: 'Category soft-deleted, or already soft-deleted (idempotent terminal-state replay). No response body.',
  description400: 'Malformed category identifier or malformed Idempotency-Key header (INVALID_RESOURCE_ID, INVALID_IDEMPOTENCY_KEY).',
  description404: 'Category not found, or category exists outside the caller\'s authoritative scope (ownership/tenant boundaries are intentionally concealed).',
  description409: 'Conflict: protected system category (SYSTEM_CATEGORY_PROTECTED), category has active dependencies (CATEGORY_HAS_ACTIVE_DEPENDENCIES), or idempotency conflict (IDEMPOTENCY_KEY_REUSED, IDEMPOTENCY_REQUEST_IN_PROGRESS).',
  extra409Examples: {
    system_category_protected: { $ref: '#/components/examples/ProblemDetailsSystemCategoryProtected' },
    category_has_active_dependencies: { $ref: '#/components/examples/ProblemDetailsCategoryActiveDependencies' },
  },
});

// --- Guardrail: op count preserved --------------------------------------
const opCountAfter = (() => {
  let n = 0;
  for (const ms of Object.values(spec.paths || {})) {
    for (const m of Object.keys(ms)) {
      if (['get','post','put','patch','delete'].includes(m)) n++;
    }
  }
  return n;
})();
if (opCountAfter !== 484) {
  throw new Error(`Operation count drifted: ${opCountAfter} (expected 484)`);
}
if (spec.info.version !== '4.53.1') {
  throw new Error(`Version drifted: ${spec.info.version}`);
}

// --- Write JSON + regenerated YAML --------------------------------------
fs.writeFileSync(JSON_PATH, JSON.stringify(spec, null, 2) + '\n');
fs.writeFileSync(YAML_PATH, yaml.dump(spec, { lineWidth: 120, noRefs: true }));

console.log('Phase 1B-R1I-c.2A: response contract corrected for budgetingDeleteBudget + budgetingDeleteCategory.');
console.log(`  version: ${spec.info.version}`);
console.log(`  operations: ${opCountAfter}`);
