#!/usr/bin/env node
/**
 * Slice 3 — Idempotency-Key on DELETE operations (additive only).
 *
 * Standing Orders cited:
 *   - ORDER 2 (Ratchet): only adds parameters, never removes.
 *   - ORDER 4 (Surgeon): additive — header is OPTIONAL (required: false) so
 *     existing clients that omit it remain conformant.
 *   - ORDER 6 (Version Gate): patch bump 4.26.8 → 4.26.9.
 *
 * Justification standard: Stripe API Reference (Idempotent Requests, 2015+),
 * Flutterwave API Reference (Idempotency-Key header), IETF draft-ietf-httpapi-
 * idempotency-key-header-06 §2.
 *
 * Action:
 *   1. For every DELETE op missing an Idempotency-Key parameter, append
 *      `$ref: '#/components/parameters/IdempotencyKey'` to op.parameters.
 *   2. Bump info.version 4.26.8 → 4.26.9.
 *   3. Re-emit openapi.json and openapi.yaml.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = process.cwd();
const JSON_PATH = path.join(ROOT, 'public/openapi.json');
const YAML_PATH = path.join(ROOT, 'public/openapi.yaml');

const spec = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const FROM = '4.26.8';
const TO = '4.26.9';
if (spec.info.version !== FROM) {
  console.error(`Expected version ${FROM}, got ${spec.info.version}. Aborting.`);
  process.exit(1);
}

if (!spec.components?.parameters?.IdempotencyKey) {
  console.error('components.parameters.IdempotencyKey not found. Aborting.');
  process.exit(1);
}

spec.info.version = TO;

const REF = { $ref: '#/components/parameters/IdempotencyKey' };
const REF_STR = REF.$ref;
const IDEMPOTENCY_NAMES = new Set([
  'idempotencykey',
  'idempotency-key',
  'idempotencykeyheader',
]);

function hasIdempotencyParam(op) {
  for (const p of op.parameters || []) {
    if (p.$ref) {
      const name = p.$ref.split('/').pop()?.toLowerCase() || '';
      if (IDEMPOTENCY_NAMES.has(name)) return true;
    } else if (p.name && IDEMPOTENCY_NAMES.has(p.name.toLowerCase())) {
      return true;
    }
  }
  return false;
}

const patched = [];
for (const [pathKey, ops] of Object.entries(spec.paths)) {
  const op = ops.delete;
  if (!op || typeof op !== 'object') continue;
  if (hasIdempotencyParam(op)) continue;
  op.parameters = op.parameters || [];
  op.parameters.push({ ...REF });
  patched.push(`DELETE ${pathKey}`);
}

fs.writeFileSync(JSON_PATH, JSON.stringify(spec, null, 2) + '\n');
fs.writeFileSync(YAML_PATH, YAML.stringify(spec, { lineWidth: 0, indent: 2 }));

console.log(`Slice 3 patch complete:`);
console.log(`  version: ${FROM} → ${TO}`);
console.log(`  patched ${patched.length} DELETE operations:`);
patched.forEach((p) => console.log('   - ' + p));
