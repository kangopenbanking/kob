#!/usr/bin/env node
/**
 * check-sdk-version-consistency.mjs
 *
 * Automated consistency gate for SDK version references. Verifies that the
 * SDK versions advertised in:
 *   - public/openapi.json `info.x-sdk-libraries` and `info.x-sdk-versions`
 *   - public/openapi.yaml (same surfaces)
 *   - public/openapi-sandbox.{json,yaml}
 *   - public/postman/manifest.json (`sdkVersions` block, if present)
 *   - public/sdk-downloads/sdk-{node,php,python}-* manifests + READMEs
 *   - packages/sdk-{node,php,python} source manifests + READMEs
 * all agree.
 *
 * SSOT = `info.x-sdk-libraries` in public/openapi.json — it represents the
 * registry reality and is the value developers will resolve when they run
 * `npm i` / `composer require` / `pip install`. Every other surface must
 * either match this exact version or omit a version reference entirely.
 *
 * Exits 1 on drift so it can be wired into CI (predeploy + PR gate).
 *
 * Standing Orders: 2 (Ratchet), 6 (Version Gate), P10 (Living Docs).
 */
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const readJson = (p) => JSON.parse(read(p));

const spec = readJson('public/openapi.json');
const libs = spec?.info?.['x-sdk-libraries'] ?? {};
const SSOT = {
  node:   libs.node?.version,
  python: libs.python?.version,
  php:    libs.php?.version,
};

if (!SSOT.node || !SSOT.python || !SSOT.php) {
  console.error('FAIL: public/openapi.json info.x-sdk-libraries is missing node/python/php versions');
  process.exit(2);
}

const checks = [];
const add = (name, actual, expected) =>
  checks.push({ name, actual: String(actual), expected: String(expected), ok: String(actual) === String(expected) });

// 1. info.x-sdk-versions must match (when present)
const flat = spec?.info?.['x-sdk-versions'] ?? {};
if (flat.node)   add('openapi.json x-sdk-versions.node',   flat.node,   SSOT.node);
if (flat.python) add('openapi.json x-sdk-versions.python', flat.python, SSOT.python);
if (flat.php)    add('openapi.json x-sdk-versions.php',    flat.php,    SSOT.php);

// 2. YAML mirrors
const yamlSdkVersion = (yaml, lang) => {
  const re = new RegExp(`${lang}:\\s*[\\s\\S]*?version:\\s*['\"]?([^\\s'\"\\n]+)`, 'm');
  return (yaml.match(re) || [])[1];
};
for (const f of ['public/openapi.yaml', 'public/openapi-sandbox.yaml']) {
  if (!fs.existsSync(f)) continue;
  const y = read(f);
  for (const lang of ['node','python','php']) {
    const v = yamlSdkVersion(y, lang);
    if (v) add(`${f} x-sdk-libraries.${lang}.version`, v, SSOT[lang]);
  }
}

// 3. Sandbox JSON
if (fs.existsSync('public/openapi-sandbox.json')) {
  const sb = readJson('public/openapi-sandbox.json');
  const sbLibs = sb?.info?.['x-sdk-libraries'] ?? {};
  for (const lang of ['node','python','php']) {
    if (sbLibs[lang]?.version) add(`openapi-sandbox.json x-sdk-libraries.${lang}`, sbLibs[lang].version, SSOT[lang]);
  }
}

// 4. Postman manifest (sdkVersions block is optional but enforced when present)
if (fs.existsSync('public/postman/manifest.json')) {
  const pm = readJson('public/postman/manifest.json');
  const pmSdk = pm?.sdkVersions ?? {};
  for (const lang of ['node','python','php']) {
    if (pmSdk[lang]) add(`postman/manifest.json sdkVersions.${lang}`, pmSdk[lang], SSOT[lang]);
  }
}

// 5. SDK download artifacts (manifests + READMEs)
const artifactManifests = [
  { lang: 'node',   path: 'public/sdk-downloads/sdk-node-package.json',   get: (j) => j.version },
  { lang: 'php',    path: 'public/sdk-downloads/sdk-php-composer.json',   get: (j) => j.version },
  { lang: 'python', path: 'public/sdk-downloads/sdk-python-pyproject.toml', get: (s) => (s.match(/^version\s*=\s*"([^"]+)"/m) || [])[1], raw: true },
];
for (const m of artifactManifests) {
  if (!fs.existsSync(m.path)) continue;
  const v = m.raw ? m.get(read(m.path)) : m.get(readJson(m.path));
  add(m.path, v, SSOT[m.lang]);
}
for (const lang of ['node','php','python']) {
  const r = `public/sdk-downloads/sdk-${lang}-README.md`;
  if (!fs.existsSync(r)) continue;
  const s = read(r);
  add(`${r} mentions SDK v${SSOT[lang]}`, s.includes(SSOT[lang]) ? 'yes' : 'no', 'yes');
}

// 6. Source SDK packages
const srcManifests = [
  { lang: 'node',   path: 'packages/sdk-node/package.json',   get: (j) => j.version },
  { lang: 'php',    path: 'packages/sdk-php/composer.json',   get: (j) => j.version },
  { lang: 'python', path: 'packages/sdk-python/pyproject.toml', get: (s) => (s.match(/^version\s*=\s*"([^"]+)"/m) || [])[1], raw: true },
];
for (const m of srcManifests) {
  if (!fs.existsSync(m.path)) continue;
  const v = m.raw ? m.get(read(m.path)) : m.get(readJson(m.path));
  add(m.path, v, SSOT[m.lang]);
}
for (const lang of ['node','php','python']) {
  const r = `packages/sdk-${lang}/README.md`;
  if (!fs.existsSync(r)) continue;
  const s = read(r);
  add(`${r} mentions SDK v${SSOT[lang]}`, s.includes(SSOT[lang]) ? 'yes' : 'no', 'yes');
}

let fail = 0;
for (const c of checks) {
  if (!c.ok) fail++;
  console.log(`${c.ok ? 'OK  ' : 'FAIL'} ${c.name}: actual=${c.actual} expected=${c.expected}`);
}
console.log(`\nSSOT (info.x-sdk-libraries) → node@${SSOT.node}  python@${SSOT.python}  php@${SSOT.php}`);
console.log(`${fail === 0 ? 'PASS' : 'FAIL'}: ${checks.length - fail}/${checks.length} SDK version references consistent`);
if (fail !== 0) {
  console.error('\nSDK version drift detected. Update the drifting surface(s) to match info.x-sdk-libraries.');
  process.exit(1);
}
