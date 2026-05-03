#!/usr/bin/env node
/**
 * predeploy.mjs — local pre-deploy gate for the developer portal.
 *
 * Runs the same checks our Netlify build and our 15-minute portal-uptime
 * GitHub Action run, so a developer can catch a stale spec, broken portal
 * route, or version drift BEFORE pushing to main.
 *
 * Usage:
 *   npm run predeploy           # full check (parity + live audit)
 *   npm run predeploy:offline   # parity check only (no network)
 *
 * Steps:
 *   1) Version-parity gate  — scripts/check-openapi-version.mjs
 *   2) Public-access audit  — scripts/audit-public-access.mjs (skipped offline)
 *
 * Exit non-zero on any failure. Justification: Standing Order 6 (Version Gate)
 * + Order P2 (Zero-404 Rule) + Order P7 (Changelog Rule).
 */
import { spawnSync } from 'node:child_process';

const OFFLINE = process.argv.includes('--offline') || process.env.PREDEPLOY_OFFLINE === '1';
const EXPECTED = process.env.EXPECTED_OPENAPI_VERSION || '4.28.2';
const AUDIT_BASE = process.env.AUDIT_BASE || 'https://kangopenbanking.com';

function run(label, cmd, args, env = {}) {
  console.log(`\n→ ${label}`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    console.error(`✗ ${label} failed (exit ${r.status})`);
    process.exit(r.status || 1);
  }
  console.log(`✓ ${label}`);
}

console.log(`Pre-deploy gate · expected v${EXPECTED} · base=${AUDIT_BASE}${OFFLINE ? ' · offline' : ''}`);

run(
  'Version-parity check (openapi.json + changelog.json)',
  'node',
  ['scripts/check-openapi-version.mjs'],
  { EXPECTED_OPENAPI_VERSION: EXPECTED }
);

if (OFFLINE) {
  console.log('\nSkipping public-access audit (offline mode).');
  process.exit(0);
}

run(
  `Public-access audit against ${AUDIT_BASE}`,
  'node',
  ['scripts/audit-public-access.mjs'],
  { AUDIT_BASE, EXPECTED_OPENAPI_VERSION: EXPECTED }
);

console.log('\nAll pre-deploy checks passed. Safe to push.');
