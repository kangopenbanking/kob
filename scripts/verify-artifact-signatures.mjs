#!/usr/bin/env node
/**
 * verify-artifact-signatures.mjs
 *
 * Verifies every signature emitted by sign-artifacts.mjs against the
 * published public key at public/artifact-signing-pubkey.pem.
 *
 * If public/artifact-signing-pubkey-next.pem is also present (staged
 * rotation), every artifact must ALSO have a `.sig.next` that verifies
 * against the next key. This is the CI gate for the rotation plan: it
 * proves the next key is live, fully signs the deploy, and can take over
 * without breaking integrators.
 *
 * Exits non-zero if any signature is missing, malformed, or invalid.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const pubPath = 'public/artifact-signing-pubkey.pem';
const pubNextPath = 'public/artifact-signing-pubkey-next.pem';
const manifestPath = 'public/downloads-checksums.json';

if (!fs.existsSync(pubPath) || !fs.existsSync(manifestPath)) {
  console.error('FAIL: signing public key or checksum manifest not found.');
  process.exit(1);
}

const pub = crypto.createPublicKey({ key: fs.readFileSync(pubPath, 'utf8'), format: 'pem' });
const pubNext = fs.existsSync(pubNextPath)
  ? crypto.createPublicKey({ key: fs.readFileSync(pubNextPath, 'utf8'), format: 'pem' })
  : null;

function fp(key) {
  const der = key.export({ type: 'spki', format: 'der' });
  return 'SHA256:' + crypto.createHash('sha256').update(der).digest('base64').replace(/=+$/, '');
}

console.log(`Current key fingerprint: ${fp(pub)}`);
if (pubNext) console.log(`Staged next key fingerprint: ${fp(pubNext)}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let ok = 0, fail = 0, okNext = 0, failNext = 0;

function verifyOne(file, sigFile, key) {
  if (!fs.existsSync(sigFile)) return { state: 'miss' };
  const sig = Buffer.from(fs.readFileSync(sigFile, 'utf8').trim(), 'base64');
  return { state: crypto.verify(null, fs.readFileSync(file), key, sig) ? 'ok' : 'fail' };
}

for (const art of manifest.artifacts) {
  const file = path.join('public', art.url.replace(/^\//, ''));
  const r = verifyOne(file, file + '.sig', pub);
  if (r.state === 'ok') ok++;
  else { fail++; console.error(`FAIL ${art.url} (current key, ${r.state})`); }

  if (pubNext) {
    const rn = verifyOne(file, file + '.sig.next', pubNext);
    if (rn.state === 'ok') okNext++;
    else { failNext++; console.error(`FAIL ${art.url} (NEXT key, ${rn.state})`); }
  }
}

// Manifest
for (const [sig, label, key, counter] of [
  ['public/SHA256SUMS.txt.sig', 'current', pub, 'cur'],
  pubNext ? ['public/SHA256SUMS.txt.sig.next', 'next', pubNext, 'next'] : null,
].filter(Boolean)) {
  if (!fs.existsSync(sig)) {
    console.error(`FAIL SHA256SUMS.txt (${label} key, missing .sig)`);
    if (counter === 'cur') fail++; else failNext++;
    continue;
  }
  const buf = Buffer.from(fs.readFileSync(sig, 'utf8').trim(), 'base64');
  const valid = crypto.verify(null, fs.readFileSync('public/SHA256SUMS.txt'), key, buf);
  if (valid) {
    if (counter === 'cur') ok++; else okNext++;
  } else {
    if (counter === 'cur') fail++; else failNext++;
    console.error(`FAIL SHA256SUMS.txt (${label} key)`);
  }
}

console.log(`Current key: ${ok} ok, ${fail} failed.`);
if (pubNext) console.log(`Next key:    ${okNext} ok, ${failNext} failed.`);
process.exit(fail === 0 && failNext === 0 ? 0 : 1);
