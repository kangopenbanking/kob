#!/usr/bin/env node
/**
 * Slice 5 — Deployed-vs-Repo Spec Parity Ratchet.
 *
 * Standing Orders cited:
 *   - ORDER 2 (Ratchet): a deploy that is older than the repo HEAD must
 *     be visible in CI before the next merge lands.
 *   - ORDER P4 (Open Spec): the published spec must always be valid AND
 *     reachable AND match what the team has merged.
 *
 * Compares info.version + path count + operation count between the local
 * public/openapi.json and the URL passed via --url (default
 * https://kob.lovable.app/openapi.json).
 *
 * Behaviour:
 *   - Hard fail if URL responds non-2xx, returns invalid JSON, or omits info.version.
 *   - Soft warn (exit 0) if deployed version is BEHIND repo (typical between
 *     PR merge and Publish click) — printed as ::warning:: for GitHub.
 *   - Hard fail if deployed version is AHEAD of repo (someone pushed direct
 *     to prod, repo is out of sync).
 *   - Hard fail if path count or operation count diverges by more than the
 *     allowed delta (default 0 — strict).
 *
 * Usage:
 *   node scripts/openapi-deployed-parity.mjs \
 *     --url https://kob.lovable.app/openapi.json \
 *     --spec public/openapi.json \
 *     [--allow-behind] [--max-path-delta 0] [--max-op-delta 0]
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
const argVal = (k, dflt) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : dflt;
};

const URL_DEFAULT = 'https://kob.lovable.app/openapi.json';
const url = argVal('--url', URL_DEFAULT);
const specPath = argVal('--spec', 'public/openapi.json');
const allowBehind = args.includes('--allow-behind');
const maxPathDelta = parseInt(argVal('--max-path-delta', '0'), 10);
const maxOpDelta = parseInt(argVal('--max-op-delta', '0'), 10);

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
function countOps(spec) {
  let n = 0;
  for (const item of Object.values(spec.paths || {})) {
    for (const m of HTTP_METHODS) if (item[m]) n++;
  }
  return n;
}

if (!fs.existsSync(specPath)) {
  console.error(`[deployed-parity] spec not found: ${specPath}`);
  process.exit(2);
}
const localSpec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const localStats = {
  version: localSpec.info?.version,
  paths: Object.keys(localSpec.paths || {}).length,
  operations: countOps(localSpec),
};

let res;
try {
  res = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
} catch (e) {
  console.error(`[deployed-parity] fetch error for ${url}: ${e.message}`);
  process.exit(1);
}

if (!res.ok) {
  console.error(`[deployed-parity] ${url} returned HTTP ${res.status}`);
  process.exit(1);
}

let deployedSpec;
try {
  deployedSpec = await res.json();
} catch (e) {
  console.error(`[deployed-parity] ${url} did not return valid JSON: ${e.message}`);
  process.exit(1);
}

if (!deployedSpec.info?.version) {
  console.error(`[deployed-parity] deployed spec missing info.version`);
  process.exit(1);
}

const deployedStats = {
  version: deployedSpec.info.version,
  paths: Object.keys(deployedSpec.paths || {}).length,
  operations: countOps(deployedSpec),
};

// Semver compare (very small, no dep). Returns -1 if a<b, 0 equal, 1 a>b.
function semverCompare(a, b) {
  const pa = a.split('.').map((x) => parseInt(x, 10));
  const pb = b.split('.').map((x) => parseInt(x, 10));
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  return 0;
}

const cmp = semverCompare(deployedStats.version, localStats.version);
const pathDelta = Math.abs(deployedStats.paths - localStats.paths);
const opDelta = Math.abs(deployedStats.operations - localStats.operations);

const summary = {
  url,
  local: localStats,
  deployed: deployedStats,
  comparison: {
    versionRelation: cmp === 0 ? 'equal' : cmp < 0 ? 'deployed-behind-repo' : 'deployed-ahead-of-repo',
    pathDelta,
    opDelta,
  },
};
console.log('Deployed vs Repo Spec Parity — summary');
console.log(JSON.stringify(summary, null, 2));

const failures = [];

if (cmp > 0) {
  failures.push(
    `Deployed spec ${deployedStats.version} is AHEAD of repo ${localStats.version}. ` +
      'Repository is out of sync with production. Pull or revert before merging.'
  );
}

if (cmp < 0 && !allowBehind) {
  // Print as warning so CI can be configured strict OR lenient.
  console.warn(
    `::warning::Deployed spec ${deployedStats.version} is BEHIND repo ${localStats.version}. ` +
      'Click Publish in Lovable (or run deploy) to roll the public origin.'
  );
}

if (pathDelta > maxPathDelta) {
  failures.push(`Path count delta ${pathDelta} exceeds allowed ${maxPathDelta}.`);
}
if (opDelta > maxOpDelta) {
  failures.push(`Operation count delta ${opDelta} exceeds allowed ${maxOpDelta}.`);
}

if (failures.length === 0) {
  console.log('\nDeployed parity OK.');
  process.exit(0);
}

console.error('\nFailures:');
failures.forEach((f) => console.error('  - ' + f));
process.exit(1);
