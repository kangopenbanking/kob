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
const PUB_OUT = 'public/artifact-signing-pubkey.pem';

function loadOrCreateKey() {
  // 1. Env (CI)
  if (process.env.KOB_ARTIFACT_SIGNING_KEY) {
    const pem = process.env.KOB_ARTIFACT_SIGNING_KEY.replace(/\\n/g, '\n');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return { priv, pub: crypto.createPublicKey(priv), source: 'env (KOB_ARTIFACT_SIGNING_KEY)' };
  }
  // 2. Local file
  if (fs.existsSync(KEY_FILE)) {
    const pem = fs.readFileSync(KEY_FILE, 'utf8');
    const priv = crypto.createPrivateKey({ key: pem, format: 'pem' });
    return { priv, pub: crypto.createPublicKey(priv), source: KEY_FILE };
  }
  // 3. Generate dev key
  fs.mkdirSync('.keys', { recursive: true });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(
    KEY_FILE,
    privateKey.export({ type: 'pkcs8', format: 'pem' }),
    { mode: 0o600 }
  );
  // Ensure .keys is gitignored
  const gi = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : '';
  if (!gi.split('\n').includes('.keys/')) {
    fs.writeFileSync('.gitignore', (gi.endsWith('\n') ? gi : gi + '\n') + '.keys/\n');
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
