#!/usr/bin/env node
/**
 * check-signing-key.mjs
 *
 * Diagnoses the Ed25519 artifact signing key setup and prints clear
 * next-step instructions when something is missing or malformed.
 *
 * Resolution order matches scripts/sign-artifacts.mjs:
 *   1. process.env.KOB_ARTIFACT_SIGNING_KEY  (build secret, preferred)
 *   2. .keys/artifact-signing.key            (local dev, auto-generated)
 *   3. kob-signing/artifact-signing.key      (operator-generated)
 *
 * Exit codes:
 *   0  — at least one valid Ed25519 PEM key was found
 *   1  — a key source exists but is not a valid Ed25519 PEM
 *   2  — no key source configured (only fatal in CI / when
 *        KOB_REQUIRE_SIGNING_KEY=1 is set)
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const CANDIDATES = [
  { kind: 'env', label: 'KOB_ARTIFACT_SIGNING_KEY (build secret)', read: () => process.env.KOB_ARTIFACT_SIGNING_KEY?.replace(/\\n/g, '\n') },
  { kind: 'file', label: '.keys/artifact-signing.key (local dev)', read: () => fs.existsSync('.keys/artifact-signing.key') ? fs.readFileSync('.keys/artifact-signing.key', 'utf8') : null },
  { kind: 'file', label: 'kob-signing/artifact-signing.key (operator)', read: () => fs.existsSync('kob-signing/artifact-signing.key') ? fs.readFileSync('kob-signing/artifact-signing.key', 'utf8') : null },
];

const IS_CI = !!(process.env.CI || process.env.NETLIFY || process.env.GITHUB_ACTIONS);
const REQUIRE = IS_CI || process.env.KOB_REQUIRE_SIGNING_KEY === '1';

function validateEd25519Pem(pem) {
  if (!pem || !pem.includes('-----BEGIN')) return { ok: false, reason: 'not a PEM block' };
  try {
    const key = crypto.createPrivateKey({ key: pem, format: 'pem' });
    if (key.asymmetricKeyType !== 'ed25519') {
      return { ok: false, reason: `wrong key type: ${key.asymmetricKeyType} (expected ed25519)` };
    }
    const pub = crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' });
    return { ok: true, publicKeyPem: pub.toString() };
  } catch (e) {
    return { ok: false, reason: `parse error: ${e.message}` };
  }
}

console.log('Artifact signing key diagnostic');
console.log('────────────────────────────────');

let found = false;
let valid = false;
let firstPub = null;
let allMatch = true;

for (const c of CANDIDATES) {
  const raw = c.read();
  if (!raw) { console.log(`  ·  ${c.label}: not set`); continue; }
  found = true;
  const res = validateEd25519Pem(raw);
  if (!res.ok) {
    console.log(`  ✗  ${c.label}: INVALID — ${res.reason}`);
    continue;
  }
  valid = true;
  if (!firstPub) firstPub = res.publicKeyPem;
  else if (res.publicKeyPem !== firstPub) allMatch = false;
  console.log(`  ✓  ${c.label}: valid Ed25519`);
}

console.log('');

if (!found) {
  console.log('No signing key configured.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Generate a keypair:');
  console.log('       mkdir -p kob-signing');
  console.log('       openssl genpkey -algorithm ed25519 -out kob-signing/artifact-signing.key');
  console.log('       openssl pkey -in kob-signing/artifact-signing.key -pubout \\');
  console.log('         -out kob-signing/artifact-signing.pub');
  console.log('  2. Copy the FULL private key PEM (including BEGIN/END lines) into');
  console.log('     Workspace Settings → Build Secrets → KOB_ARTIFACT_SIGNING_KEY.');
  console.log('  3. Redeploy. /artifact-signing-pubkey.pem will then be stable.');
  console.log('');
  console.log('  Local-only fallback: scripts/sign-artifacts.mjs will auto-generate');
  console.log('  .keys/artifact-signing.key on first run (dev only — never deploy).');
  process.exit(REQUIRE ? 2 : 0);
}

if (!valid) {
  console.error('A key source exists but no valid Ed25519 PEM was found.');
  console.error('Re-generate using:');
  console.error('  openssl genpkey -algorithm ed25519 -out kob-signing/artifact-signing.key');
  process.exit(1);
}

if (!allMatch) {
  console.warn('⚠  Multiple key sources are configured and they DO NOT MATCH.');
  console.warn('   sign-artifacts.mjs will prefer KOB_ARTIFACT_SIGNING_KEY → .keys/ → kob-signing/.');
  console.warn('   Remove the stale source(s) to avoid integrator confusion.');
}

console.log('Signing key is ready. Public key (SPKI PEM):');
console.log(firstPub.trim());
process.exit(0);
