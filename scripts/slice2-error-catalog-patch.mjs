#!/usr/bin/env node
/**
 * Slice 2 — Error catalog tightening (additive only).
 *
 * Standing Orders cited:
 *   - ORDER 2 (Ratchet): only adds responses, never removes.
 *   - ORDER 4 (Surgeon): additive — no operationId/path/schema changes.
 *   - ORDER 6 (Version Gate): patch bump 4.26.7 → 4.26.8.
 *
 * Justification standard: RFC 7807 (Problem Details) + RFC 6585 §4 (429)
 * + RFC 7231 §6.5.8 (409 Conflict).
 *
 * Action:
 *   1. Add reusable `components.responses.Conflict` (RFC 7807).
 *   2. For every POST/PUT/PATCH/DELETE op missing 409, attach $ref Conflict.
 *   3. For every POST/PUT/PATCH/DELETE op missing 429, attach $ref TooManyRequests.
 *   4. Bump info.version 4.26.7 → 4.26.8.
 *   5. Re-emit openapi.json and openapi.yaml byte-stable.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = process.cwd();
const JSON_PATH = path.join(ROOT, 'public/openapi.json');
const YAML_PATH = path.join(ROOT, 'public/openapi.yaml');

const spec = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// 1. Bump version (Standing Order 6)
const FROM = '4.26.7';
const TO = '4.26.8';
if (spec.info.version !== FROM) {
  console.error(`Expected version ${FROM}, got ${spec.info.version}. Aborting.`);
  process.exit(1);
}
spec.info.version = TO;

// 2. Add reusable Conflict response (additive — Surgeon Rule)
spec.components ??= {};
spec.components.responses ??= {};
if (!spec.components.responses.Conflict) {
  spec.components.responses.Conflict = {
    description:
      "Conflict — the request conflicts with current resource state. " +
      "Typically returned when an `Idempotency-Key` is reused with a different payload, " +
      "or when an entity-version (`If-Match`) precondition fails. RFC 7231 §6.5.8.",
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetails' },
      },
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
      },
    },
  };
}

// 3. Attach 409 + 429 to mutations that lack them
const MUTATING = new Set(['post', 'put', 'patch', 'delete']);
let added409 = 0;
let added429 = 0;

for (const [p, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    if (!MUTATING.has(method)) continue;
    if (typeof op !== 'object' || !op.responses) continue;

    if (!op.responses['409']) {
      op.responses['409'] = { $ref: '#/components/responses/Conflict' };
      added409++;
    }
    if (!op.responses['429']) {
      op.responses['429'] = { $ref: '#/components/responses/TooManyRequests' };
      added429++;
    }
  }
}

// 4. Persist JSON
fs.writeFileSync(JSON_PATH, JSON.stringify(spec, null, 2) + '\n');

// 5. Persist YAML
fs.writeFileSync(
  YAML_PATH,
  YAML.stringify(spec, { lineWidth: 0, indent: 2 })
);

console.log(`Slice 2 patch complete:`);
console.log(`  version:  ${FROM} → ${TO}`);
console.log(`  added 409 responses: ${added409}`);
console.log(`  added 429 responses: ${added429}`);
console.log(`  reusable Conflict response: ${spec.components.responses.Conflict ? 'present' : 'MISSING'}`);
