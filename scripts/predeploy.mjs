#!/usr/bin/env node
/**
 * predeploy.mjs — local + Netlify pre-deploy gate for the developer portal.
 *
 * Steps:
 *   1) Version-parity gate  — scripts/check-openapi-version.mjs
 *   2) Public-access audit  — scripts/audit-public-access.mjs (skipped offline)
 *
 * On failure, if SLACK_WEBHOOK_URL is set in the environment (e.g. configured
 * as a Netlify build environment variable), POST a short message describing
 * the failing step before exiting non-zero.
 *
 * Justification: Standing Order 6 (Version Gate) + Order P2 (Zero-404 Rule)
 * + Order P7 (Changelog Rule).
 */
import { spawnSync } from 'node:child_process';
import { resolveExpectedVersion } from './lib/read-expected-version.mjs';

const OFFLINE = process.argv.includes('--offline') || process.env.PREDEPLOY_OFFLINE === '1';
const EXPECTED = resolveExpectedVersion();
const AUDIT_BASE = process.env.AUDIT_BASE || 'https://kangopenbanking.com';
const SLACK = process.env.SLACK_WEBHOOK_URL;
const CONTEXT =
  process.env.CONTEXT /* netlify */ ||
  process.env.GITHUB_WORKFLOW /* gh actions */ ||
  'local';

async function notifySlack(stepLabel, exitCode) {
  if (!SLACK) return;
  const commit = (process.env.COMMIT_REF || process.env.GITHUB_SHA || '').slice(0, 7);
  const site = process.env.SITE_NAME || process.env.URL || AUDIT_BASE;
  const text = `:rotating_light: *Predeploy gate failed* (${CONTEXT})\n` +
    `• Step: \`${stepLabel}\` (exit ${exitCode})\n` +
    `• Site: ${site}\n` +
    `• Commit: ${commit || 'n/a'}\n` +
    `• Expected API version: v${EXPECTED}`;
  try {
    await fetch(SLACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error(`Slack notify failed: ${e.message}`);
  }
}

async function run(label, cmd, args, env = {}) {
  console.log(`\n→ ${label}`);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    console.error(`✗ ${label} failed (exit ${r.status})`);
    await notifySlack(label, r.status ?? 1);
    process.exit(r.status || 1);
  }
  console.log(`✓ ${label}`);
}

console.log(
  `Pre-deploy gate · expected v${EXPECTED} · base=${AUDIT_BASE}${OFFLINE ? ' · offline' : ''}`
);

await run(
  'Sync version artifacts (openapi/changelog/postman → SSOT)',
  'node',
  ['scripts/sync-version-artifacts.mjs'],
  { EXPECTED_OPENAPI_VERSION: EXPECTED }
);

await run(
  'Version-parity check (openapi.json + changelog.json)',
  'node',
  ['scripts/check-openapi-version.mjs'],
  { EXPECTED_OPENAPI_VERSION: EXPECTED }
);

if (OFFLINE) {
  console.log('\nSkipping public-access audit (offline mode).');
  process.exit(0);
}

await run(
  `Public-access audit against ${AUDIT_BASE}`,
  'node',
  ['scripts/audit-public-access.mjs'],
  { AUDIT_BASE, EXPECTED_OPENAPI_VERSION: EXPECTED }
);

console.log('\nAll pre-deploy checks passed. Safe to push.');
