#!/usr/bin/env node
/**
 * generate-artifact-checksums.mjs
 *
 * Generates SHA-256 checksums for every public download exposed on the
 * developer portal, writing:
 *
 *   public/downloads-checksums.json   (machine-readable, served at /downloads-checksums.json)
 *   public/SHA256SUMS.txt             (BSD-style coreutils-compatible file)
 *
 * Integrators can verify with:
 *   curl -sSO https://kangopenbanking.com/SHA256SUMS.txt
 *   sha256sum -c SHA256SUMS.txt
 *
 * Justification: Standing Order P4 (Open Spec Rule) + P5 (Working Code Rule).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const cfg = fs.readFileSync('src/config/version.ts', 'utf8');
const API = cfg.match(/KOB_API_VERSION\s*=\s*"([^"]+)"/)[1];
const SDK = {
  node: cfg.match(/node:\s*"([^"]+)"/)[1],
  python: cfg.match(/python:\s*"([^"]+)"/)[1],
  php: cfg.match(/php:\s*"([^"]+)"/)[1],
};

const FILES = [
  // OpenAPI (current)
  { url: '/openapi.json', file: 'public/openapi.json', category: 'openapi', version: API },
  { url: '/openapi.yaml', file: 'public/openapi.yaml', category: 'openapi', version: API },
  { url: '/openapi-sandbox.json', file: 'public/openapi-sandbox.json', category: 'openapi-sandbox', version: API },
  { url: '/openapi-sandbox.yaml', file: 'public/openapi-sandbox.yaml', category: 'openapi-sandbox', version: API },
  { url: '/apis.json', file: 'public/apis.json', category: 'apis-discovery', version: API },
  { url: '/apis-sandbox.json', file: 'public/apis-sandbox.json', category: 'apis-discovery', version: API },
  // OpenAPI (versioned snapshot)
  { url: `/openapi-history/openapi-${API}.json`, file: `public/openapi-history/openapi-${API}.json`, category: 'openapi-history', version: API },
  { url: `/openapi-history/openapi-${API}.yaml`, file: `public/openapi-history/openapi-${API}.yaml`, category: 'openapi-history', version: API },
  // Postman
  { url: '/postman/Kang_Open_Banking_API_latest.postman_collection.json', file: 'public/postman/Kang_Open_Banking_API_latest.postman_collection.json', category: 'postman', version: API },
  { url: `/postman/Kang_Open_Banking_API_v${API}.postman_collection.json`, file: `public/postman/Kang_Open_Banking_API_v${API}.postman_collection.json`, category: 'postman', version: API },
  { url: '/postman/Kang_Open_Banking_Sandbox.postman_environment.json', file: 'public/postman/Kang_Open_Banking_Sandbox.postman_environment.json', category: 'postman-env', version: API },
  { url: '/postman/Kang_Open_Banking_Production.postman_environment.json', file: 'public/postman/Kang_Open_Banking_Production.postman_environment.json', category: 'postman-env', version: API },
  // SDK downloads
  { url: '/sdk-downloads/sdk-node-package.json', file: 'public/sdk-downloads/sdk-node-package.json', category: 'sdk-node', version: SDK.node },
  { url: '/sdk-downloads/sdk-node-README.md', file: 'public/sdk-downloads/sdk-node-README.md', category: 'sdk-node', version: SDK.node },
  { url: '/sdk-downloads/sdk-php-composer.json', file: 'public/sdk-downloads/sdk-php-composer.json', category: 'sdk-php', version: SDK.php },
  { url: '/sdk-downloads/sdk-php-README.md', file: 'public/sdk-downloads/sdk-php-README.md', category: 'sdk-php', version: SDK.php },
  { url: '/sdk-downloads/sdk-python-pyproject.toml', file: 'public/sdk-downloads/sdk-python-pyproject.toml', category: 'sdk-python', version: SDK.python },
  { url: '/sdk-downloads/sdk-python-README.md', file: 'public/sdk-downloads/sdk-python-README.md', category: 'sdk-python', version: SDK.python },
  // Changelog
  { url: '/changelog.json', file: 'public/changelog.json', category: 'changelog', version: API },
];

const entries = [];
const sumsLines = [];
for (const f of FILES) {
  if (!fs.existsSync(f.file)) {
    console.warn(`SKIP missing: ${f.file}`);
    continue;
  }
  const buf = fs.readFileSync(f.file);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const size = buf.length;
  entries.push({ url: f.url, category: f.category, version: f.version, size, sha256 });
  sumsLines.push(`${sha256}  .${f.url}`);
}

const manifest = {
  ssot: { apiVersion: API, sdkVersions: SDK },
  generatedAt: new Date().toISOString(),
  algorithm: 'sha256',
  verifyHint: 'curl -sSO https://kangopenbanking.com/SHA256SUMS.txt && sha256sum -c SHA256SUMS.txt',
  artifacts: entries,
};

fs.writeFileSync('public/downloads-checksums.json', JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(
  'public/SHA256SUMS.txt',
  `# Kang Open Banking — artifact checksums\n# Generated: ${manifest.generatedAt}\n# API: v${API}  SDK: node@${SDK.node} php@${SDK.php} python@${SDK.python}\n# Verify: sha256sum -c SHA256SUMS.txt\n${sumsLines.join('\n')}\n`
);

console.log(`Wrote ${entries.length} checksums → public/downloads-checksums.json + public/SHA256SUMS.txt`);
