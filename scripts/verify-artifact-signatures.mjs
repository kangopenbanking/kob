#!/usr/bin/env node
/**
 * verify-artifact-signatures.mjs
 *
 * Verifies every signature emitted by sign-artifacts.mjs against the
 * public key at public/artifact-signing-pubkey.pem.
 *
 * Exits non-zero if any signature is missing, malformed, or fails to verify.
 * Used by the predeploy gate and the artifact-smoke-test GitHub Action.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const pubPath = 'public/artifact-signing-pubkey.pem';
const manifestPath = 'public/downloads-checksums.json';
if (!fs.existsSync(pubPath) || !fs.existsSync(manifestPath)) {
  console.error('FAIL: signing public key or checksum manifest not found.');
  process.exit(1);
}
const pub = crypto.createPublicKey({ key: fs.readFileSync(pubPath, 'utf8'), format: 'pem' });
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let ok = 0;
let fail = 0;
for (const art of manifest.artifacts) {
  const file = path.join('public', art.url.replace(/^\//, ''));
  const sigFile = file + '.sig';
  if (!fs.existsSync(sigFile)) {
    console.error(`MISS ${art.url} (no .sig)`);
    fail++;
    continue;
  }
  const sig = Buffer.from(fs.readFileSync(sigFile, 'utf8').trim(), 'base64');
  const valid = crypto.verify(null, fs.readFileSync(file), pub, sig);
  if (valid) {
    ok++;
  } else {
    console.error(`FAIL ${art.url}`);
    fail++;
  }
}

// Verify the manifest signature
const sumsSig = 'public/SHA256SUMS.txt.sig';
if (fs.existsSync(sumsSig)) {
  const sig = Buffer.from(fs.readFileSync(sumsSig, 'utf8').trim(), 'base64');
  const valid = crypto.verify(null, fs.readFileSync('public/SHA256SUMS.txt'), pub, sig);
  if (valid) ok++; else { fail++; console.error('FAIL SHA256SUMS.txt.sig'); }
}

console.log(`Verified ${ok} signatures, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
