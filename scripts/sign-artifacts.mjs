#!/usr/bin/env node
/**
 * sign-artifacts.mjs
 *
 * Signs every public download with an Ed25519 detached signature so
 * integrators can prove a file came from this build pipeline.
 *
 * Key resolution (in order):
 *   1. KOB_ARTIFACT_SIGNING_KEY env var   — PEM-encoded Ed25519 PRIVATE key
 *      (Netlify / GitHub Actions build secret). Public key is derived.
 *   2. kob-signing/artifact-signing.key   — operator-generated key.
 *   3. .keys/artifact-signing.key on disk — local dev key (auto-generated
 *      and gitignored on first run).
 *
 * Staged rotation:
 *   If KOB_NEXT_ARTIFACT_SIGNING_KEY (env) OR kob-signing/artifact-signing-next.key
 *   is present, every artifact ALSO gets a `<file>.sig.next` signature using the
 *   next key, and `/artifact-signing-pubkey-next.pem` is published. This lets
 *   integrators pre-pin the next public key before the cutover, so rotation
 *   does not break existing pipelines.
 *
 * Output:
 *   - public/<path>.sig                       — base64 detached signature (current key)
 *   - public/<path>.sig.next                  — base64 detached signature (next key, optional)
 *   - public/SHA256SUMS.txt.sig               — signature over the combined manifest
 *   - public/SHA256SUMS.txt.sig.next          — manifest signature with next key (optional)
 *   - public/artifact-signing-pubkey.pem      — current Ed25519 PUBLIC key (PEM, SPKI)
 *   - public/artifact-signing-pubkey-next.pem — staged next PUBLIC key (PEM, SPKI, optional)
 *
 * Verify with `node scripts/verify-artifact-signatures.mjs`.
 *
 * Justification: NIST SP 800-57 Pt.1 §5.6 (signature key strength + rotation),
 * RFC 8032 (Ed25519), Standing Orders P4 + P7.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KEY_FILE = '.keys/artifact-signing.key';
const OPERATOR_KEY_FILE = 'kob-signing/artifact-signing.key';
const OPERATOR_NEXT_KEY_FILE = 'kob-signing/artifact-signing-next.key';
const PUB_OUT = 'public/artifact-signing-pubkey.pem';
const PUB_NEXT_OUT = 'public/artifact-signing-pubkey-next.pem';

const IS_CI = !!(process.env.CI || process.env.NETLIFY || process.env.GITHUB_ACTIONS);
const REQUIRE_ENV_KEY = IS_CI || process.env.KOB_REQUIRE_SIGNING_KEY === '1';

function fingerprint(pubKey) {
  // SHA-256 of SPKI DER, formatted "SHA256:<base64>" (OpenSSH-style) + hex with colons.
  const der = pubKey.export({ type: 'spki', format: 'der' });
  const hash = crypto.createHash('sha256').update(der).digest();
  const hex = hash.toString('hex').match(/.{2}/g).join(':');
  return {
    algorithm: 'ed25519',
    sha256Hex: hex,
    sha256Base64: `SHA256:${hash.toString('base64').replace(/=+$/, '')}`,
  };
}

function loadOrCreateKey() {
  // 1. Env (CI / production)
  if (process.env.KOB_ARTIFACT_SIGNING_KEY) {
    const pem = process.env.KOB_ARTIFACT_SIGNING_KEY.replace(/\\n/g, '\n');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    if (priv.asymmetricKeyType !== 'ed25519') {
      throw new Error(`KOB_ARTIFACT_SIGNING_KEY is not an Ed25519 key (got ${priv.asymmetricKeyType}).`);
    }
    return { priv, pub: crypto.createPublicKey(priv), source: 'env (KOB_ARTIFACT_SIGNING_KEY)' };
  }

  if (REQUIRE_ENV_KEY) {
    console.error('');
    console.error('✗ FATAL: KOB_ARTIFACT_SIGNING_KEY is not set in this build environment.');
    console.error('');
    console.error('  Refusing to generate a throwaway dev key in CI — doing so would');
    console.error('  publish a new /artifact-signing-pubkey.pem on every deploy and');
    console.error('  break every integrator who pinned the previous public key.');
    console.error('');
    console.error('  Fix:');
    console.error('    1. openssl genpkey -algorithm ed25519 -out kob-signing/artifact-signing.key');
    console.error('    2. Workspace → Build Secrets → KOB_ARTIFACT_SIGNING_KEY = full PEM.');
    console.error('    3. Re-run the deploy.');
    console.error('');
    console.error('  See docs/governance/ARTIFACT_SIGNING_KEYS.md for full guidance.');
    console.error('  To intentionally bypass (NOT recommended), set KOB_ALLOW_EPHEMERAL_SIGNING_KEY=1.');
    if (process.env.KOB_ALLOW_EPHEMERAL_SIGNING_KEY !== '1') {
      process.exit(1);
    }
    console.error('  KOB_ALLOW_EPHEMERAL_SIGNING_KEY=1 detected — continuing with ephemeral key.');
  }

  if (fs.existsSync(OPERATOR_KEY_FILE)) {
    const pem = fs.readFileSync(OPERATOR_KEY_FILE, 'utf8');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return { priv, pub: crypto.createPublicKey(priv), source: OPERATOR_KEY_FILE };
  }
  if (fs.existsSync(KEY_FILE)) {
    const pem = fs.readFileSync(KEY_FILE, 'utf8');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return { priv, pub: crypto.createPublicKey(priv), source: KEY_FILE };
  }
  fs.mkdirSync('.keys', { recursive: true });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(KEY_FILE, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  const gi = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
  const lines = gi.split('\n');
  let changed = false;
  for (const entry of ['.keys/', 'kob-signing/']) {
    if (!lines.includes(entry)) { lines.push(entry); changed = true; }
  }
  if (changed) {
    try { fs.writeFileSync('.gitignore', lines.join('\n').replace(/\n+$/, '\n')); } catch {}
  }
  return { priv: privateKey, pub: publicKey, source: `${KEY_FILE} (generated)` };
}

function loadNextKey() {
  if (process.env.KOB_NEXT_ARTIFACT_SIGNING_KEY) {
    const pem = process.env.KOB_NEXT_ARTIFACT_SIGNING_KEY.replace(/\\n/g, '\n');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    if (priv.asymmetricKeyType !== 'ed25519') {
      throw new Error(`KOB_NEXT_ARTIFACT_SIGNING_KEY is not Ed25519 (got ${priv.asymmetricKeyType}).`);
    }
    return { priv, pub: crypto.createPublicKey(priv), source: 'env (KOB_NEXT_ARTIFACT_SIGNING_KEY)' };
  }
  if (fs.existsSync(OPERATOR_NEXT_KEY_FILE)) {
    const pem = fs.readFileSync(OPERATOR_NEXT_KEY_FILE, 'utf8');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return { priv, pub: crypto.createPublicKey(priv), source: OPERATOR_NEXT_KEY_FILE };
  }
  return null;
}

const { priv, pub, source } = loadOrCreateKey();
const next = loadNextKey();

fs.writeFileSync(PUB_OUT, pub.export({ type: 'spki', format: 'pem' }));
const fp = fingerprint(pub);
let nextFp = null;
if (next) {
  fs.writeFileSync(PUB_NEXT_OUT, next.pub.export({ type: 'spki', format: 'pem' }));
  nextFp = fingerprint(next.pub);
  if (nextFp.sha256Hex === fp.sha256Hex) {
    console.warn('⚠  Next signing key is IDENTICAL to current key — rotation would be a no-op.');
  }
} else if (fs.existsSync(PUB_NEXT_OUT)) {
  // No next key configured this build → remove stale staged pubkey to avoid confusion.
  fs.unlinkSync(PUB_NEXT_OUT);
}

const manifestPath = 'public/downloads-checksums.json';
if (!fs.existsSync(manifestPath)) {
  console.error(`FAIL: ${manifestPath} not found. Run scripts/generate-artifact-checksums.mjs first.`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

let signed = 0;
for (const art of manifest.artifacts) {
  const file = path.join('public', art.url.replace(/^\//, ''));
  if (!fs.existsSync(file)) continue;
  const buf = fs.readFileSync(file);
  const sig = crypto.sign(null, buf, priv);
  fs.writeFileSync(file + '.sig', sig.toString('base64') + '\n');
  art.signature = {
    algorithm: 'ed25519',
    encoding: 'base64',
    sigUrl: art.url + '.sig',
    publicKeyFingerprint: fp.sha256Base64,
  };
  if (next) {
    const sigNext = crypto.sign(null, buf, next.priv);
    fs.writeFileSync(file + '.sig.next', sigNext.toString('base64') + '\n');
    art.signature.nextSigUrl = art.url + '.sig.next';
    art.signature.nextPublicKeyFingerprint = nextFp.sha256Base64;
  } else {
    // Remove stale .sig.next if it exists
    if (fs.existsSync(file + '.sig.next')) fs.unlinkSync(file + '.sig.next');
  }
  signed++;
}

const sumsPath = 'public/SHA256SUMS.txt';
if (fs.existsSync(sumsPath)) {
  const sumsBuf = fs.readFileSync(sumsPath);
  fs.writeFileSync(sumsPath + '.sig', crypto.sign(null, sumsBuf, priv).toString('base64') + '\n');
  if (next) {
    fs.writeFileSync(sumsPath + '.sig.next', crypto.sign(null, sumsBuf, next.priv).toString('base64') + '\n');
  } else if (fs.existsSync(sumsPath + '.sig.next')) {
    fs.unlinkSync(sumsPath + '.sig.next');
  }
}

manifest.signing = {
  algorithm: 'ed25519',
  publicKeyUrl: '/' + PUB_OUT.replace(/^public\//, ''),
  publicKeyFingerprint: fp.sha256Base64,
  publicKeyFingerprintSha256Hex: fp.sha256Hex,
  manifestSigUrl: '/SHA256SUMS.txt.sig',
  keySource: source.startsWith('env') ? 'env' : 'local-dev',
  signedAt: new Date().toISOString(),
  verifyInstructionsUrl: '/developer/openapi#verify',
  rotationDocsUrl: '/developer/openapi#rotation',
  next: next ? {
    publicKeyUrl: '/' + PUB_NEXT_OUT.replace(/^public\//, ''),
    publicKeyFingerprint: nextFp.sha256Base64,
    publicKeyFingerprintSha256Hex: nextFp.sha256Hex,
    manifestSigUrl: '/SHA256SUMS.txt.sig.next',
    keySource: next.source.startsWith('env') ? 'env' : 'local-dev',
    status: 'staged',
    note: 'Pre-pin this key before the announced rotation date. After cutover it becomes the active key.',
  } : null,
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Signed ${signed} artifacts + SHA256SUMS.txt with Ed25519 key from ${source}`);
console.log(`  current fingerprint: ${fp.sha256Base64}`);
if (next) console.log(`  staged next fingerprint: ${nextFp.sha256Base64} (from ${next.source})`);
if (source.includes('generated')) {
  console.warn('\n⚠  Using a locally generated dev key. Set KOB_ARTIFACT_SIGNING_KEY in production.');
}
