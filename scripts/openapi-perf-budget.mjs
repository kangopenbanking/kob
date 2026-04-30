#!/usr/bin/env node
/**
 * Slice 5 — OpenAPI Performance Budget Ratchet.
 *
 * Standing Orders cited:
 *   - ORDER 2 (Ratchet): operation/schema/path counts may only move up.
 *   - ORDER 4 (Surgeon): hard ceilings catch accidental bloat (e.g. a
 *     duplicated tag generator that 3x's the spec).
 *
 * Justification standard: Stripe API Reference target spec size <300KB
 * gzipped (industry ceiling for fast SDK regen). We set 200KB.
 *
 * Reads scripts/openapi-perf-budget.json. Exits 1 on any breach.
 *
 * Usage:  node scripts/openapi-perf-budget.mjs [--spec public/openapi.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const specIdx = args.indexOf('--spec');
const specPath = specIdx >= 0 ? args[specIdx + 1] : 'public/openapi.json';
const budgetPath = path.join(path.dirname(specPath).replace(/^public$/, 'scripts'), 'openapi-perf-budget.json');
const resolvedBudget = fs.existsSync(budgetPath)
  ? budgetPath
  : 'scripts/openapi-perf-budget.json';

if (!fs.existsSync(specPath)) {
  console.error(`[perf-budget] spec not found: ${specPath}`);
  process.exit(2);
}
if (!fs.existsSync(resolvedBudget)) {
  console.error(`[perf-budget] budget file not found: ${resolvedBudget}`);
  process.exit(2);
}

const raw = fs.readFileSync(specPath);
const spec = JSON.parse(raw.toString('utf8'));
const budget = JSON.parse(fs.readFileSync(resolvedBudget, 'utf8'));

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

const stats = {
  rawBytes: raw.length,
  gzipBytes: zlib.gzipSync(raw, { level: 9 }).length,
  paths: Object.keys(spec.paths || {}).length,
  operations: 0,
  schemas: Object.keys(spec.components?.schemas || {}).length,
};
for (const item of Object.values(spec.paths || {})) {
  for (const m of HTTP_METHODS) if (item[m]) stats.operations++;
}

const limits = budget.limits;
const failures = [];

function ceilCheck(label, value, max) {
  if (value > max) failures.push(`${label} CEILING breached: ${value} > ${max}`);
}
function floorCheck(label, value, min) {
  if (value < min) failures.push(`${label} FLOOR breached (ratchet): ${value} < ${min}`);
}

ceilCheck('rawBytes', stats.rawBytes, limits.rawBytesMax);
ceilCheck('gzipBytes', stats.gzipBytes, limits.gzipBytesMax);
ceilCheck('operations', stats.operations, limits.operationsMax);
ceilCheck('schemas', stats.schemas, limits.schemasMax);

floorCheck('paths.count', stats.paths, limits.paths.minCount);
floorCheck('operations.count', stats.operations, limits.operations.minCount);
floorCheck('schemas.count', stats.schemas, limits.schemas.minCount);

const summary = {
  spec: specPath,
  apiVersion: spec.info?.version,
  measured: stats,
  budget: limits,
  failures: failures.length,
};
console.log('OpenAPI performance budget — summary');
console.log(JSON.stringify(summary, null, 2));

if (failures.length === 0) {
  console.log('\nAll budget checks passed.');
  process.exit(0);
}
console.error('\nFailures:');
failures.forEach((f) => console.error('  - ' + f));
console.error(
  '\nIf the floor moved up legitimately (new endpoints), bump the matching minCount in scripts/openapi-perf-budget.json (Standing Order 2).' +
    '\nIf a ceiling needs raising, file a Guardian-signed PR explaining why.'
);
process.exit(1);
