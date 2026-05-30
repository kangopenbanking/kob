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
 *   2. .keys/artifact-signing.key on disk — local dev key (auto-generated
 *      and gitignored on first run).
 *
 * Output:
 *   - public/<path>.sig                  — base64 detached signature per file
 *   - public/SHA256SUMS.txt.sig          — signature over the combined manifest
 *   - public/artifact-signing-pubkey.pem — Ed25519 PUBLIC key (PEM, SPKI)
 *
 * Verify with `node scripts/verify-artifact-signatures.mjs` (CI) or:
 *   openssl pkeyutl -verify -pubin -inkey artifact-signing-pubkey.pem \
 *     -rawin -in openapi.json -sigfile openapi.json.sig
 *
 * Justification: NIST SP 800-57 Pt.1 §5.6 (signature key strength),
 * RFC 8032 (Ed25519), Standing Orders P4 + P7.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KEY_FILE = '.keys/artifact-signing.key';
const OPERATOR_KEY_FILE = 'kob-signing/artifact-signing.key';
const PUB_OUT = 'public/artifact-signing-pubkey.pem';

const IS_CI = !!(process.env.CI || process.env.NETLIFY || process.env.GITHUB_ACTIONS);
const REQUIRE_ENV_KEY = IS_CI || process.env.KOB_REQUIRE_SIGNING_KEY === '1';

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

  // CI must never sign with an ephemeral dev key — fail hard with guidance.
  if (REQUIRE_ENV_KEY) {
    console.error('');
    console.error('✗ FATAL: KOB_ARTIFACT_SIGNING_KEY is not set in this build environment.');
    console.error('');
    console.error('  Refusing to generate a throwaway dev key in CI — doing so would');
    console.error('  publish a new /artifact-signing-pubkey.pem on every deploy and');
    console.error('  break every integrator who pinned the previous public key.');
    console.error('');
    console.error('  Fix:');
    console.error('    1. Generate (or reuse) an Ed25519 keypair locally:');
    console.error('         openssl genpkey -algorithm ed25519 -out kob-signing/artifact-signing.key');
    console.error('    2. Workspace Settings → Build Secrets → add KOB_ARTIFACT_SIGNING_KEY');
    console.error('       with the FULL private-key PEM (BEGIN/END lines included).');
    console.error('    3. Re-run the deploy.');
    console.error('');
    console.error('  See docs/governance/ARTIFACT_SIGNING_KEYS.md for full guidance.');
    console.error('  To intentionally bypass (NOT recommended), set KOB_ALLOW_EPHEMERAL_SIGNING_KEY=1.');
    if (process.env.KOB_ALLOW_EPHEMERAL_SIGNING_KEY !== '1') {
      process.exit(1);
    }
    console.error('  KOB_ALLOW_EPHEMERAL_SIGNING_KEY=1 detected — continuing with ephemeral key.');
  }

  // 2. Operator key (kob-signing/)
  if (fs.existsSync(OPERATOR_KEY_FILE)) {
    const pem = fs.readFileSync(OPERATOR_KEY_FILE, 'utf8');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return { priv, pub: crypto.createPublicKey(priv), source: OPERATOR_KEY_FILE };
  }
  // 3. Local dev key
  if (fs.existsSync(KEY_FILE)) {
    const pem = fs.readFileSync(KEY_FILE, 'utf8');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return { priv, pub: crypto.createPublicKey(priv), source: KEY_FILE };
  }
  // 4. Generate dev key (local only)
  fs.mkdirSync('.keys', { recursive: true });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(
    KEY_FILE,
    privateKey.export({ type: 'pkcs8', format: 'pem' }),
    { mode: 0o600 }
  );
  // Ensure .keys and kob-signing are gitignored
  const gi = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
  const lines = gi.split('\n');
  let changed = false;
  for (const entry of ['.keys/', 'kob-signing/']) {
    if (!lines.includes(entry)) { lines.push(entry); changed = true; }
  }
  if (changed) {
    try { fs.writeFileSync('.gitignore', lines.join('\n').replace(/\n+$/, '\n')); }
    catch { /* .gitignore may be read-only in some sandboxes; non-fatal */ }
  }
  return { priv: privateKey, pub: publicKey, source: `${KEY_FILE} (generated)` };
}


const { priv, pub, source } = loadOrCreateKey();

// Export public key
fs.writeFileSync(PUB_OUT, pub.export({ type: 'spki', format: 'pem' }));

// Read manifest produced by generate-artifact-checksums.mjs
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
  const sig = crypto.sign(null, buf, priv); // Ed25519: digest must be null
  fs.writeFileSync(file + '.sig', sig.toString('base64') + '\n');
  art.signature = { algorithm: 'ed25519', encoding: 'base64', sigUrl: art.url + '.sig' };
  signed++;
}

// Sign the SHA256SUMS.txt manifest too
const sumsPath = 'public/SHA256SUMS.txt';
if (fs.existsSync(sumsPath)) {
  const sig = crypto.sign(null, fs.readFileSync(sumsPath), priv);
  fs.writeFileSync(sumsPath + '.sig', sig.toString('base64') + '\n');
}

// Re-stamp the metadata
manifest.signing = {
  algorithm: 'ed25519',
  publicKeyUrl: '/' + PUB_OUT.replace(/^public\//, ''),
  manifestSigUrl: '/SHA256SUMS.txt.sig',
  keySource: source.startsWith('env') ? 'env' : 'local-dev',
  signedAt: new Date().toISOString(),
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(`Signed ${signed} artifacts + SHA256SUMS.txt with Ed25519 key from ${source}`);
console.log(`Public key: /${PUB_OUT.replace(/^public\//, '')}`);
if (source.includes('generated')) {
  console.warn(
    '\n⚠  Using a locally generated dev key. For production, set KOB_ARTIFACT_SIGNING_KEY ' +
      'as a build secret so the deployed public key is stable.'
  );
}
