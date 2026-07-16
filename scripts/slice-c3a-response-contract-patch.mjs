#!/usr/bin/env node
/**
 * Phase 1B-R1I-c.3A — Goal archive and round-up disable response contract correction.
 *
 * Additive-only. Adds 400/401/404/409/429/500 to:
 *   - budgetingDeleteGoal      (DELETE /v1/budgeting/goals/{goalId})
 *   - budgetingDisableRoundUp  (DELETE /v1/budgeting/goals/{goalId}/round-up)
 *
 * Uses existing reusable Problem Details responses/components. Adds two new
 * components.examples entries (GoalHasPendingFinancialOperations,
 * RoundupHasPendingInstructions) referenced by the 409 responses. Preserves
 * version 4.53.1, operation count 484. Regenerates YAML from the updated JSON.
 *
 * Justification:
 *   - Ratified c.0A semantics: archive-only for goals, disable-flag for round-up.
 *   - Predecessor gate: PHASE 1B-R1I-c.3 BLOCKED (contract lacked non-204 responses).
 *   - Standing Order #4 (Surgeon Rule): additive-only.
 *   - Standing Order #6 (Version Gate): unchanged 4.53.1 (Unreleased contract).
 *   - Standing Order #2 (Ratchet): improves G6 without weakening any gate.
 *   - 403 OMITTED — masked 404 used for owner/tenant isolation (parity with c.2A).
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const JSON_PATH = path.join(ROOT, 'public/openapi.json');
const YAML_PATH = path.join(ROOT, 'public/openapi.yaml');

const spec = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

if (spec.info?.version !== '4.53.1') {
  throw new Error(`Expected version 4.53.1, got ${spec.info?.version}`);
}
const countOps = () => {
  let n = 0;
  for (const ms of Object.values(spec.paths || {})) {
    for (const m of Object.keys(ms)) {
      if (['get','post','put','patch','delete'].includes(m)) n++;
    }
  }
  return n;
};
const opCountBefore = countOps();
if (opCountBefore !== 484) throw new Error(`Expected 484 operations, got ${opCountBefore}`);

// --- New reusable Problem Details examples ------------------------------
spec.components.examples = spec.components.examples || {};

spec.components.examples.ProblemDetailsGoalHasPendingFinancialOperations = {
  summary: 'Goal has unresolved financial operations and cannot be archived',
  value: {
    type: 'https://api.kangopenbanking.com/errors/goal-has-pending-financial-operations',
    title: 'Goal Has Pending Financial Operations',
    status: 409,
    detail: 'The savings goal cannot be archived while it has unresolved contributions, transfers, settlements, payment instructions or round-up instructions.',
    instance: '/v1/budgeting/goals/00000000-0000-4000-8000-000000000000',
    code: 'GOAL_HAS_PENDING_FINANCIAL_OPERATIONS',
    error_id: 'err_goalpend_a1b2c3',
    timestamp: '2026-07-16T10:00:00Z',
  },
};

spec.components.examples.ProblemDetailsGoalStateConflict = {
  summary: 'Goal lifecycle state does not permit archival',
  value: {
    type: 'https://api.kangopenbanking.com/errors/goal-state-conflict',
    title: 'Goal State Conflict',
    status: 409,
    detail: 'The savings goal is in a lifecycle state that does not permit archival.',
    instance: '/v1/budgeting/goals/00000000-0000-4000-8000-000000000000',
    code: 'GOAL_STATE_CONFLICT',
    error_id: 'err_goalstate_a1b2c3',
    timestamp: '2026-07-16T10:00:00Z',
  },
};

spec.components.examples.ProblemDetailsRoundupHasPendingInstructions = {
  summary: 'Round-up has pending instructions preventing disablement',
  value: {
    type: 'https://api.kangopenbanking.com/errors/roundup-has-pending-instructions',
    title: 'Round-Up Has Pending Instructions',
    status: 409,
    detail: 'Round-up cannot be disabled while pending round-up instructions remain unresolved.',
    instance: '/v1/budgeting/goals/00000000-0000-4000-8000-000000000000/round-up',
    code: 'ROUNDUP_HAS_PENDING_INSTRUCTIONS',
    error_id: 'err_ruspend_a1b2c3',
    timestamp: '2026-07-16T10:00:00Z',
  },
};

spec.components.examples.ProblemDetailsRoundupStateConflict = {
  summary: 'Round-up configuration is in a state that cannot be disabled immediately',
  value: {
    type: 'https://api.kangopenbanking.com/errors/roundup-state-conflict',
    title: 'Round-Up State Conflict',
    status: 409,
    detail: 'Round-up cannot be disabled from its current state.',
    instance: '/v1/budgeting/goals/00000000-0000-4000-8000-000000000000/round-up',
    code: 'ROUNDUP_STATE_CONFLICT',
    error_id: 'err_rustate_a1b2c3',
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

function makeBadRequestResponse(description) {
  return {
    description,
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

function makeConflictResponse(description, extraExampleRefs = {}) {
  return {
    description,
    headers: {},
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetails' },
        examples: {
          default: { $ref: '#/components/examples/ProblemDetailsConflict' },
          idempotency_key_reused: { $ref: '#/components/examples/ProblemDetailsIdempotencyKeyReused' },
          ...extraExampleRefs,
        },
      },
    },
  };
}

function patchOp({ operationId, semantics, d204, d400, d409, extra409 = {} }) {
  const found = findOp(operationId);
  if (!found) throw new Error(`Operation not found: ${operationId}`);
  const op = found.op;

  op.responses['204'].description = d204;
  op.responses['400'] = makeBadRequestResponse(d400);
  op.responses['401'] = { $ref: '#/components/responses/Unauthorized' };
  op.responses['404'] = { $ref: '#/components/responses/NotFound' };
  op.responses['409'] = makeConflictResponse(d409, extra409);
  op.responses['429'] = { $ref: '#/components/responses/TooManyRequests' };
  op.responses['500'] = { $ref: '#/components/responses/InternalServerError' };

  op.description = semantics;
}

patchOp({
  operationId: 'budgetingDeleteGoal',
  semantics: 'Archives an eligible savings goal by transitioning it to its approved terminal archived state. The goal is not physically deleted; contributions, progress history, round-up transactions and events, ledger entries, payment records, settlement records and reconciliation records are preserved unchanged. No automatic refund, reversal or cancellation is performed. Returns 204 on the first successful transition, on a valid same-key idempotent replay, and when the goal is already in the archived terminal state (no repeated mutation, audit event or notification is emitted). 404 is returned when the goal does not exist OR when it exists but lies outside the authenticated caller\'s authoritative scope (ownership/tenant boundaries are intentionally concealed). Archival is blocked (409 GOAL_HAS_PENDING_FINANCIAL_OPERATIONS) while the goal has unresolved contributions, transfers, settlements, payment instructions or round-up instructions; unsupported lifecycle transitions return 409 GOAL_STATE_CONFLICT.',
  d204: 'Goal archived, already archived (idempotent terminal-state replay), or valid same-key idempotent replay. No response body.',
  d400: 'Malformed goal identifier or malformed Idempotency-Key header (INVALID_RESOURCE_ID, INVALID_IDEMPOTENCY_KEY). UUIDv5 and oversized idempotency header values are rejected here.',
  d409: 'Conflict: unresolved financial operations (GOAL_HAS_PENDING_FINANCIAL_OPERATIONS), unsupported lifecycle transition (GOAL_STATE_CONFLICT), or idempotency conflict (IDEMPOTENCY_KEY_REUSED when the same key is reused with a changed request body; IDEMPOTENCY_REQUEST_IN_PROGRESS for a concurrent same-key request).',
  extra409: {
    goal_has_pending_financial_operations: { $ref: '#/components/examples/ProblemDetailsGoalHasPendingFinancialOperations' },
    goal_state_conflict: { $ref: '#/components/examples/ProblemDetailsGoalStateConflict' },
  },
});

patchOp({
  operationId: 'budgetingDisableRoundUp',
  semantics: 'Disables future round-up activity for the specified savings goal by flipping the round-up configuration flag to disabled. The round-up configuration row, completed round-up transactions, round-up events, ledger postings, reconciliation records and audit trail are preserved unchanged. Existing pending round-up instructions are not implicitly cancelled, reversed or settled by this operation. Returns 204 on the first successful transition, on a valid same-key idempotent replay, and when round-up is already disabled (no repeated mutation, audit event or notification is emitted). 404 is returned when the goal or round-up configuration does not exist OR when it lies outside the authenticated caller\'s authoritative scope (ownership/tenant boundaries are intentionally concealed). 409 is returned when a ratified pending-instruction policy blocks disablement (ROUNDUP_HAS_PENDING_INSTRUCTIONS) or when the round-up configuration is in a state that cannot be disabled immediately (ROUNDUP_STATE_CONFLICT).',
  d204: 'Round-up disabled, already disabled (idempotent terminal-state replay), or valid same-key idempotent replay. No response body.',
  d400: 'Malformed goal identifier or malformed Idempotency-Key header (INVALID_RESOURCE_ID, INVALID_IDEMPOTENCY_KEY). UUIDv5 and oversized idempotency header values are rejected here.',
  d409: 'Conflict: pending round-up instructions block disablement per the ratified policy (ROUNDUP_HAS_PENDING_INSTRUCTIONS), round-up configuration state prevents immediate disablement (ROUNDUP_STATE_CONFLICT), or idempotency conflict (IDEMPOTENCY_KEY_REUSED, IDEMPOTENCY_REQUEST_IN_PROGRESS).',
  extra409: {
    roundup_has_pending_instructions: { $ref: '#/components/examples/ProblemDetailsRoundupHasPendingInstructions' },
    roundup_state_conflict: { $ref: '#/components/examples/ProblemDetailsRoundupStateConflict' },
  },
});

// --- Guardrails ---------------------------------------------------------
const opCountAfter = countOps();
if (opCountAfter !== 484) throw new Error(`Operation count drifted: ${opCountAfter} (expected 484)`);
if (spec.info.version !== '4.53.1') throw new Error(`Version drifted: ${spec.info.version}`);

fs.writeFileSync(JSON_PATH, JSON.stringify(spec, null, 2) + '\n');
fs.writeFileSync(YAML_PATH, yaml.dump(spec, { lineWidth: 120, noRefs: true }));

console.log('Phase 1B-R1I-c.3A: response contract corrected for budgetingDeleteGoal + budgetingDisableRoundUp.');
console.log(`  version:    ${spec.info.version}`);
console.log(`  operations: ${opCountAfter}`);
