// @ts-nocheck
/**
 * Phase 1A — OpenAPI Quality Gate integrity harness.
 *
 * Executes scripts/openapi-quality-gates.mjs as a child process against
 * synthetic, in-memory fixture specs to prove every gate G1–G9 fires
 * correctly, positive controls pass, allowlist behaviour works, and
 * later gates are not skipped by earlier ones.
 *
 * Never mutates public/openapi.json.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const SCRIPT = path.resolve(process.cwd(), 'scripts/openapi-quality-gates.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kob-gates-'));

afterAll(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} });

/** Run the gate script against a fixture and return { status, byGate, failures, stdout, stderr }. */
function runGates(spec, opts = {}) {
  const specFile = path.join(TMP, `spec-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(specFile, JSON.stringify(spec, null, 2));
  const args = ['--spec', specFile];
  if (opts.allowlist) {
    const allowFile = path.join(TMP, `allow-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(allowFile, JSON.stringify(opts.allowlist));
    args.push('--allowlist', allowFile);
  } else {
    // Point --allowlist to an empty allowlist so the harness never inherits the
    // production allowlist file.
    const empty = path.join(TMP, `allow-empty-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(empty, JSON.stringify({ G1: [], G2: [], G3: [], G4: [], G5: [], G6: [], G7: [], G8: [], G9: [] }));
    args.push('--allowlist', empty);
  }
  const proc = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  let byGate = {};
  const m = proc.stdout.match(/"byGate":\s*({[\s\S]*?})/);
  if (m) { try { byGate = JSON.parse(m[1]); } catch {} }
  return { status: proc.status, stdout: proc.stdout, stderr: proc.stderr, byGate };
}

// ─── Fixture builders ────────────────────────────────────────────────────────

/** Components block that satisfies every gate when $ref'd. */
const COMMON_COMPONENTS = {
  parameters: {
    RequestId:      { name: 'X-Request-ID',    in: 'header', schema: { type: 'string' } },
    IdempotencyKey: { name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', format: 'uuid' } },
    Limit:          { name: 'limit',           in: 'query',  schema: { type: 'integer' } },
    Cursor:         { name: 'cursor',          in: 'query',  schema: { type: 'string' } },
    StartingAfter:  { name: 'starting_after',  in: 'query',  schema: { type: 'string' } },
    EndingBefore:   { name: 'ending_before',   in: 'query',  schema: { type: 'string' } },
    Offset:         { name: 'offset',          in: 'query',  schema: { type: 'integer' } },
  },
  schemas: {
    ProblemDetails: { type: 'object', properties: { type: { type: 'string' }, title: { type: 'string' } } },
    Thing:          { type: 'object', properties: { id: { type: 'string' } } },
    ThingList:      { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Thing' } } } },
  },
};

const PROBLEM_RESP = { description: 'error', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } };
const CONFLICT     = PROBLEM_RESP;
const TOO_MANY     = PROBLEM_RESP;
const OK_JSON      = { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/Thing' } } } };
const OK_LIST      = { description: 'ok', content: { 'application/json': { schema: { $ref: '#/components/schemas/ThingList' } } } };
const REQ_ID       = { $ref: '#/components/parameters/RequestId' };
const IDEMP        = { $ref: '#/components/parameters/IdempotencyKey' };

/** Standard mutation responses that satisfy G1/G5/G6. */
const MUTATION_RESPS = { '200': OK_JSON, '400': PROBLEM_RESP, '409': CONFLICT, '429': TOO_MANY, '500': PROBLEM_RESP };

/** Compliant GET list at `path` (paginated w/ cursor + X-Request-ID + problem errors). */
function compliantListOp() {
  return {
    parameters: [REQ_ID, { $ref: '#/components/parameters/Limit' }, { $ref: '#/components/parameters/Cursor' }],
    responses: { '200': OK_LIST, '400': PROBLEM_RESP },
  };
}

/** Compliant non-financial POST (no idempotency required unless webhook/financial/DELETE). */
function compliantSimpleMutation() {
  return { parameters: [REQ_ID], responses: MUTATION_RESPS };
}

/** Compliant financial mutation. */
function compliantFinancialMutation() {
  return { parameters: [REQ_ID, IDEMP], responses: MUTATION_RESPS };
}

/** Compliant DELETE (idempotent). */
function compliantDelete() {
  return { parameters: [REQ_ID, IDEMP], responses: MUTATION_RESPS };
}

/** Compliant webhook POST (signature + dedupe docs + full mutation resps). */
function compliantWebhook() {
  return {
    description: 'Verifies X-KOB-Signature (HMAC) and dedupes on event_id.',
    parameters: [REQ_ID, { name: 'X-KOB-Signature', in: 'header', schema: { type: 'string' } }],
    responses: MUTATION_RESPS,
  };
}

/** Base compliant spec containing one of every op-type the gates evaluate.
 *  Deep-cloned on every call so per-test mutations never leak into shared refs. */
function baseCompliantSpec() {
  return JSON.parse(JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Fixture', version: '0.0.0' },
    servers: [{ url: 'https://example.test/v1' }],
    components: COMMON_COMPONENTS,
    paths: {
      '/things':            { get: compliantListOp() },
      '/things/{id}':       { get: { parameters: [REQ_ID], responses: { '200': OK_JSON, '400': PROBLEM_RESP } },
                              delete: compliantDelete() },
      '/v1/payments':       { post: compliantFinancialMutation() },
      '/simple':            { post: compliantSimpleMutation() },
      '/webhooks/provider': { post: compliantWebhook() },
    },
  }));
}

const clone = (o) => JSON.parse(JSON.stringify(o));

// ─── Positive control ────────────────────────────────────────────────────────

describe('Phase 1A · fully compliant fixture', () => {
  it('passes with exit 0 and zero failures', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.stdout).toContain('All gates passed');
    expect(r.status).toBe(0);
    expect(r.byGate).toEqual({ G1: 0, G2: 0, G3: 0, G4: 0, G5: 0, G6: 0, G7: 0, G8: 0, G9: 0 });
  });
});

// ─── G1 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G1 (2xx schema)', () => {
  it('negative: 200 response missing schema fails only G1', () => {
    const s = baseCompliantSpec();
    s.paths['/things/{id}'].get.responses['200'] = { description: 'ok' }; // no content
    const r = runGates(s);
    expect(r.status).not.toBe(0);
    expect(r.byGate.G1).toBe(1);
    expect(r.byGate).toMatchObject({ G2: 0, G3: 0, G4: 0, G5: 0, G6: 0, G7: 0, G8: 0, G9: 0 });
  });
  it('positive control: adding schema clears G1', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.byGate.G1).toBe(0);
  });
});

// ─── G2 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G2 (webhook signature + dedupe)', () => {
  it('G2A: missing signature evidence fails G2', () => {
    const s = baseCompliantSpec();
    s.paths['/webhooks/provider'].post.description = 'Dedupes on event_id.';
    s.paths['/webhooks/provider'].post.parameters = [REQ_ID]; // strip signature header
    const r = runGates(s);
    expect(r.byGate.G2).toBe(1);
  });
  it('G2B: missing dedupe evidence fails G2', () => {
    const s = baseCompliantSpec();
    s.paths['/webhooks/provider'].post.description = 'verifies HMAC signature only';
    const r = runGates(s);
    expect(r.byGate.G2).toBe(1);
  });
  it('positive: signature header + dedupe note passes G2', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.byGate.G2).toBe(0);
  });
  it('scope: a non-webhook POST does not trigger G2', () => {
    const s = baseCompliantSpec();
    delete s.paths['/webhooks/provider'];
    const r = runGates(s);
    expect(r.byGate.G2).toBe(0);
  });
});

// ─── G3 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G3 (financial mutation idempotency)', () => {
  it('negative: /v1/payments POST without Idempotency-Key fails G3', () => {
    const s = baseCompliantSpec();
    s.paths['/v1/payments'].post.parameters = [REQ_ID];
    const r = runGates(s);
    expect(r.byGate.G3).toBe(1);
  });
  it('positive: adding Idempotency-Key clears G3', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.byGate.G3).toBe(0);
  });
  it('scope: non-financial POST does not trigger G3', () => {
    const s = baseCompliantSpec();
    s.paths['/simple'].post.parameters = [REQ_ID]; // no idempotency
    const r = runGates(s);
    expect(r.byGate.G3).toBe(0);
  });
});

// ─── G4 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G4 (list pagination)', () => {
  it('negative: array-returning GET list without pagination fails G4', () => {
    const s = baseCompliantSpec();
    s.paths['/things'].get.parameters = [REQ_ID]; // strip limit/cursor
    const r = runGates(s);
    expect(r.byGate.G4).toBe(1);
  });
  it('positive: cursor+limit passes G4', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.byGate.G4).toBe(0);
  });
  it('behaviour: page+limit is accepted', () => {
    const s = baseCompliantSpec();
    s.paths['/things'].get.parameters = [REQ_ID,
      { $ref: '#/components/parameters/Limit' },
      { name: 'page', in: 'query', schema: { type: 'integer' } }];
    const r = runGates(s);
    expect(r.byGate.G4).toBe(0);
  });
  it('scope: single-resource GET does not trigger G4', () => {
    const s = baseCompliantSpec();
    delete s.paths['/things']; // only /things/{id} remains
    const r = runGates(s);
    expect(r.byGate.G4).toBe(0);
  });
});

// ─── G5 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G5 (RFC 7807 errors)', () => {
  it('negative: 400 with application/json (not problem+json) fails G5', () => {
    const s = baseCompliantSpec();
    s.paths['/simple'].post.responses['400'] = { description: 'bad', content: { 'application/json': { schema: { type: 'object' } } } };
    const r = runGates(s);
    expect(r.byGate.G5).toBeGreaterThanOrEqual(1);
  });
  it('positive: application/problem+json passes G5', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.byGate.G5).toBe(0);
  });
  it('behaviour: $ref error response is accepted', () => {
    const s = baseCompliantSpec();
    s.components.responses = { Err: PROBLEM_RESP };
    s.paths['/simple'].post.responses['400'] = { $ref: '#/components/responses/Err' };
    const r = runGates(s);
    expect(r.byGate.G5).toBe(0);
  });
});

// ─── G6 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G6 (409 + 429 on mutations)', () => {
  it('G6A: mutation missing 409 fails G6 with count 1', () => {
    const s = baseCompliantSpec();
    delete s.paths['/simple'].post.responses['409'];
    const r = runGates(s);
    expect(r.byGate.G6).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/409/);
  });
  it('G6B: mutation missing 429 fails G6 with count 1', () => {
    const s = baseCompliantSpec();
    delete s.paths['/simple'].post.responses['429'];
    const r = runGates(s);
    expect(r.byGate.G6).toBe(1);
    expect(r.stderr + r.stdout).toMatch(/429/);
  });
  it('combined: missing both yields G6 count 2', () => {
    const s = baseCompliantSpec();
    delete s.paths['/simple'].post.responses['409'];
    delete s.paths['/simple'].post.responses['429'];
    const r = runGates(s);
    expect(r.byGate.G6).toBe(2);
  });
  it('positive: both present passes G6', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.byGate.G6).toBe(0);
  });
  it('scope: GET does not trigger G6', () => {
    const s = baseCompliantSpec();
    // /things GET has no 409/429 by design
    const r = runGates(s);
    expect(r.byGate.G6).toBe(0);
  });
});

// ─── G7 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G7 (DELETE idempotency)', () => {
  it('negative: DELETE without Idempotency-Key fails G7 (non-financial path)', () => {
    const s = baseCompliantSpec();
    s.paths['/things/{id}'].delete.parameters = [REQ_ID];
    const r = runGates(s);
    expect(r.byGate.G7).toBe(1);
    expect(r.byGate.G3).toBe(0); // path is non-financial
  });
  it('positive: DELETE with Idempotency-Key passes G7', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.byGate.G7).toBe(0);
  });
});

// ─── G8 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G8 (cursor parity on paginated lists)', () => {
  it('negative: paginated list with offset but no cursor fails G8', () => {
    const s = baseCompliantSpec();
    s.paths['/things'].get.parameters = [REQ_ID,
      { $ref: '#/components/parameters/Limit' },
      { $ref: '#/components/parameters/Offset' }];
    const r = runGates(s);
    expect(r.byGate.G8).toBe(1);
  });
  it('positive: adding cursor (starting_after/ending_before) clears G8', () => {
    const s = baseCompliantSpec();
    s.paths['/things'].get.parameters = [REQ_ID,
      { $ref: '#/components/parameters/Limit' },
      { $ref: '#/components/parameters/Offset' },
      { $ref: '#/components/parameters/StartingAfter' },
      { $ref: '#/components/parameters/EndingBefore' }];
    const r = runGates(s);
    expect(r.byGate.G8).toBe(0);
  });
  it('behaviour: single cursor param satisfies gate (either direction)', () => {
    const s = baseCompliantSpec();
    s.paths['/things'].get.parameters = [REQ_ID,
      { $ref: '#/components/parameters/Limit' },
      { $ref: '#/components/parameters/Offset' },
      { $ref: '#/components/parameters/StartingAfter' }];
    const r = runGates(s);
    expect(r.byGate.G8).toBe(0);
  });
});

// ─── G9 ──────────────────────────────────────────────────────────────────────

describe('Phase 1A · G9 (X-Request-ID everywhere)', () => {
  it('negative: op without X-Request-ID fails G9', () => {
    const s = baseCompliantSpec();
    s.paths['/simple'].post.parameters = [];
    const r = runGates(s);
    expect(r.byGate.G9).toBeGreaterThanOrEqual(1);
  });
  it('positive: X-Request-ID present passes G9', () => {
    const r = runGates(baseCompliantSpec());
    expect(r.byGate.G9).toBe(0);
  });
});

// ─── Multi-gate fixture ──────────────────────────────────────────────────────

describe('Phase 1A · multi-gate fixture proves later gates are not skipped', () => {
  it('violating G1+G3+G5+G6+G9 in one op reports every gate', () => {
    const s = baseCompliantSpec();
    // Break /v1/payments POST across many gates:
    s.paths['/v1/payments'].post = {
      parameters: [], // strips REQ_ID (G9) and IDEMP (G3)
      responses: {
        '200': { description: 'ok' },                                              // G1
        '400': { description: 'bad', content: { 'application/json': { schema: {} } } }, // G5
        // no 409 (G6) and no 429 (G6) → G6 count 2
      },
    };
    const r = runGates(s);
    expect(r.status).not.toBe(0);
    expect(r.byGate.G1).toBeGreaterThanOrEqual(1);
    expect(r.byGate.G3).toBeGreaterThanOrEqual(1);
    expect(r.byGate.G5).toBeGreaterThanOrEqual(1);
    expect(r.byGate.G6).toBeGreaterThanOrEqual(2);
    expect(r.byGate.G9).toBeGreaterThanOrEqual(1);
  });
});

// ─── Allowlist behaviour ─────────────────────────────────────────────────────

describe('Phase 1A · allowlist behaviour', () => {
  it('exact allowlist entry suppresses only the intended gate', () => {
    const s = baseCompliantSpec();
    s.paths['/v1/payments'].post.parameters = [REQ_ID]; // triggers G3
    const r = runGates(s, { allowlist: { G3: ['POST /v1/payments'], G1: [], G2: [], G4: [], G5: [], G6: [], G7: [], G8: [], G9: [] } });
    expect(r.byGate.G3).toBe(0);
    expect(r.status).toBe(0);
  });
  it('wrong-path allowlist entry does not suppress the violation', () => {
    const s = baseCompliantSpec();
    s.paths['/v1/payments'].post.parameters = [REQ_ID];
    const r = runGates(s, { allowlist: { G3: ['POST /wrong/path'], G1: [], G2: [], G4: [], G5: [], G6: [], G7: [], G8: [], G9: [] } });
    expect(r.byGate.G3).toBe(1);
    expect(r.status).not.toBe(0);
  });
  it('allowlisting one gate does not suppress another gate for the same op', () => {
    const s = baseCompliantSpec();
    s.paths['/v1/payments'].post.parameters = [];
    s.paths['/v1/payments'].post.responses = { '200': OK_JSON, '400': PROBLEM_RESP, '409': CONFLICT, '429': TOO_MANY };
    const r = runGates(s, { allowlist: { G3: ['POST /v1/payments'], G1: [], G2: [], G4: [], G5: [], G6: [], G7: [], G8: [], G9: [] } });
    expect(r.byGate.G3).toBe(0);
    expect(r.byGate.G9).toBeGreaterThanOrEqual(1);
    expect(r.status).not.toBe(0);
  });
  it('removing the exception restores the failure', () => {
    const s = baseCompliantSpec();
    s.paths['/v1/payments'].post.parameters = [REQ_ID];
    const noAllow = runGates(s);
    expect(noAllow.byGate.G3).toBe(1);
  });
});

// ─── Direct-invocation exit-code contract (regression for `tail` masking) ────

describe('Phase 1A · exit-code contract (Phase 1 regression)', () => {
  it('production spec direct invocation exits non-zero while violations remain', () => {
    const proc = spawnSync(process.execPath, [SCRIPT, '--spec', 'public/openapi.json'], { encoding: 'utf8' });
    expect(proc.status).toBe(1);
  });
});
