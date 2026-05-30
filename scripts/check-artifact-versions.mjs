#!/usr/bin/env node
/**
 * check-artifact-versions.mjs
 *
 * Predeploy gate: verifies every downloadable artifact on the developer
 * portal matches the SSOT in src/config/version.ts.
 *
 * Covers:
 *   - public/openapi.json + .yaml (production spec)
 *   - public/openapi-sandbox.json + .yaml (sandbox spec)
 *   - public/openapi-history/manifest.json + per-version snapshot
 *   - public/postman/manifest.json + latest + per-version collection
 *   - public/changelog.json
 *   - public/sdk-downloads/sdk-{node,php,python}-* (manifests + READMEs)
 *   - packages/sdk-{node,php,python} (source manifests)
 *
 * Justification: Standing Orders 6 (Version Gate) + P7 (Changelog Rule)
 * + P10 (Living Docs Rule).
 */
import fs from 'node:fs';

const root = process.cwd();
const cfg = fs.readFileSync('src/config/version.ts', 'utf8');
const API = cfg.match(/KOB_API_VERSION\s*=\s*"([^"]+)"/)?.[1];
const SDK = {
  node: cfg.match(/node:\s*"([^"]+)"/)?.[1],
  python: cfg.match(/python:\s*"([^"]+)"/)?.[1],
  php: cfg.match(/php:\s*"([^"]+)"/)?.[1],
};
if (!API || !SDK.node || !SDK.python || !SDK.php) {
  console.error('FAIL: could not parse SSOT from src/config/version.ts');
  process.exit(2);
}

const checks = [];
const add = (name, actual, expected) =>
  checks.push({ name, actual: String(actual), expected: String(expected), ok: String(actual) === String(expected) });

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const yamlVersion = (p) =>
  (fs.readFileSync(p, 'utf8').match(/^\s*version:\s*['"]?([^\s'"\n]+)/m) || [])[1];

// ---- OpenAPI specs ----
add('openapi.json info.version', readJson('public/openapi.json').info.version, API);
add('openapi-sandbox.json info.version', readJson('public/openapi-sandbox.json').info.version, API);
add('openapi.yaml info.version', yamlVersion('public/openapi.yaml'), API);
add('openapi-sandbox.yaml info.version', yamlVersion('public/openapi-sandbox.yaml'), API);

// ---- History ----
add(
  'openapi-history/openapi-<v>.json present',
  fs.existsSync(`public/openapi-history/openapi-${API}.json`) ? 'yes' : 'no',
  'yes'
);
add(
  'openapi-history/openapi-<v>.yaml present',
  fs.existsSync(`public/openapi-history/openapi-${API}.yaml`) ? 'yes' : 'no',
  'yes'
);
add('openapi-history manifest.current', readJson('public/openapi-history/manifest.json').current, API);

// ---- Postman ----
const pm = readJson('public/postman/manifest.json');
add('postman manifest.apiVersion', pm.apiVersion, API);
add('postman manifest.current', pm.current, API);
const latestPm = readJson('public/postman/Kang_Open_Banking_API_latest.postman_collection.json');
add('postman latest info.version', latestPm.info?.version, API);
add(
  'postman versioned collection present',
  fs.existsSync(`public/postman/Kang_Open_Banking_API_v${API}.postman_collection.json`) ? 'yes' : 'no',
  'yes'
);

// ---- Changelog ----
const cl = readJson('public/changelog.json');
add('changelog.json apiVersion', cl.apiVersion || cl.current || cl.versions?.[0]?.version, API);

// ---- SDK download artifacts ----
add('sdk-downloads/sdk-node-package.json', readJson('public/sdk-downloads/sdk-node-package.json').version, SDK.node);
add('sdk-downloads/sdk-php-composer.json', readJson('public/sdk-downloads/sdk-php-composer.json').version, SDK.php);
add(
  'sdk-downloads/sdk-python-pyproject.toml',
  (fs.readFileSync('public/sdk-downloads/sdk-python-pyproject.toml', 'utf8').match(/^version\s*=\s*"([^"]+)"/m) || [])[1],
  SDK.python
);

const readmes = [
  ['sdk-node-README.md', SDK.node],
  ['sdk-php-README.md', SDK.php],
  ['sdk-python-README.md', SDK.python],
];
for (const [r, sdkV] of readmes) {
  const s = fs.readFileSync(`public/sdk-downloads/${r}`, 'utf8');
  add(`${r} mentions SDK v${sdkV}`, s.includes(sdkV) ? 'yes' : 'no', 'yes');
  add(`${r} mentions API v${API}`, s.includes(API) ? 'yes' : 'no', 'yes');
}

// ---- Source packages ----
add('packages/sdk-node/package.json', readJson('packages/sdk-node/package.json').version, SDK.node);
add('packages/sdk-php/composer.json', readJson('packages/sdk-php/composer.json').version, SDK.php);
add(
  'packages/sdk-python/pyproject.toml',
  (fs.readFileSync('packages/sdk-python/pyproject.toml', 'utf8').match(/^version\s*=\s*"([^"]+)"/m) || [])[1],
  SDK.python
);

let fail = 0;
for (const c of checks) {
  if (!c.ok) fail++;
  console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}: actual=${c.actual} expected=${c.expected}`);
}
console.log(`\nSSOT API=v${API}  SDK=node@${SDK.node} php@${SDK.php} python@${SDK.python}`);
console.log(`${fail === 0 ? 'PASS' : 'FAIL'}: ${checks.length - fail}/${checks.length} checks passed`);
if (fail !== 0) {
  console.error('\nArtifact version drift detected. Bump the drifting file(s) to match src/config/version.ts.');
  process.exit(1);
}
