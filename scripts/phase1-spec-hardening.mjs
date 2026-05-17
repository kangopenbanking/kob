#!/usr/bin/env node
/**
 * Phase 1 — API Contract Hardening
 * Additive changes only (Standing Order 4):
 *   1. Add StartingAfter + EndingBefore parameter components and append
 *      them to every offset-only list operation (offset retained per SO-1).
 *   2. Add RequestId parameter component (X-Request-ID) referenced on
 *      every operation that already declares parameters.
 *   3. Normalize inline 4xx/5xx responses that ship without a schema to
 *      the shared $ref responses (BadRequest, Unauthorized, ...).
 *   4. Bump info.version → 4.33.0 (SO-6).
 *
 * Run: node scripts/phase1-spec-hardening.mjs
 */
import fs from 'node:fs';

const SPEC = 'public/openapi.json';
const NEXT_VERSION = '4.33.0';
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));

spec.components ??= {};
spec.components.parameters ??= {};
spec.components.responses ??= {};

// ---- 1. Cursor parameter components ----
spec.components.parameters.StartingAfter ??= {
  name: 'starting_after',
  in: 'query',
  required: false,
  description:
    'Cursor for pagination. Returns results immediately after the supplied object id. Mutually exclusive with `ending_before`. Offset-style `offset` is also accepted for backward compatibility.',
  schema: { type: 'string', maxLength: 128 },
};
spec.components.parameters.EndingBefore ??= {
  name: 'ending_before',
  in: 'query',
  required: false,
  description:
    'Cursor for pagination. Returns results immediately before the supplied object id. Mutually exclusive with `starting_after`.',
  schema: { type: 'string', maxLength: 128 },
};

// ---- 2. RequestId parameter component ----
spec.components.parameters.RequestId ??= {
  name: 'X-Request-ID',
  in: 'header',
  required: false,
  description:
    'Client-supplied correlation id (UUID v4 recommended). Echoed back in the `X-Request-ID` response header and persisted across edge functions, ledger writes and outbound webhook deliveries for distributed tracing.',
  schema: { type: 'string', maxLength: 64, pattern: '^[A-Za-z0-9._-]{1,64}$' },
};

const refName = (p) => (p?.$ref ? p.$ref.split('/').pop() : p?.name);

let cursorAdded = 0;
let problemNormalized = 0;
let requestIdAdded = 0;

const codeToResponse = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  422: 'UnprocessableEntity',
  429: 'TooManyRequests',
  500: 'InternalServerError',
  503: 'ServiceUnavailable',
};

for (const [path, methods] of Object.entries(spec.paths || {})) {
  for (const [method, op] of Object.entries(methods)) {
    if (!op || typeof op !== 'object' || !op.responses) continue;

    // ----- cursor parity on offset-only list ops -----
    if (method === 'get') {
      const params = op.parameters || [];
      const names = params.map(refName);
      const hasLimit = names.some((n) => /Limit|^limit$/.test(n));
      const hasOffset = names.some((n) => /Offset|^offset$/.test(n));
      const hasCursor = names.some((n) =>
        /StartingAfter|starting_after|EndingBefore|ending_before|Cursor|cursor/.test(n),
      );
      if (hasLimit && hasOffset && !hasCursor) {
        params.push({ $ref: '#/components/parameters/StartingAfter' });
        params.push({ $ref: '#/components/parameters/EndingBefore' });
        op.parameters = params;
        cursorAdded += 1;
      }
    }

    // ----- request id header (additive, applies to all ops) -----
    op.parameters ??= [];
    const hasReqId = op.parameters.some(
      (p) => refName(p) === 'RequestId' || p.name === 'X-Request-ID',
    );
    if (!hasReqId) {
      op.parameters.push({ $ref: '#/components/parameters/RequestId' });
      requestIdAdded += 1;
    }

    // ----- normalize empty inline 4xx/5xx to shared $ref responses -----
    for (const [code, resp] of Object.entries(op.responses)) {
      if (!codeToResponse[code]) continue;
      if (resp.$ref) continue;
      const content = resp.content || {};
      const c = content['application/problem+json'] || content['application/json'] || {};
      const sref = c.schema?.$ref || '';
      if (sref.endsWith('/ProblemDetails')) continue;
      // inline shell with no/empty schema → swap to canonical shared response
      op.responses[code] = {
        $ref: `#/components/responses/${codeToResponse[code]}`,
      };
      problemNormalized += 1;
    }
  }
}

// ---- bump version per SO-6 ----
spec.info.version = NEXT_VERSION;

fs.writeFileSync(SPEC, JSON.stringify(spec, null, 2) + '\n');

console.log(JSON.stringify({
  newVersion: NEXT_VERSION,
  cursorAdded,
  problemNormalized,
  requestIdAdded,
}, null, 2));
