#!/usr/bin/env node
/**
 * kob-fetch — one-command CLI installer for Kang Open Banking artifacts.
 *
 * Usage (no install):
 *   npx -p https://kangopenbanking.com/scripts/kob-fetch.mjs kob-fetch <target>
 *   # or
 *   curl -sSL https://kangopenbanking.com/scripts/kob-fetch.mjs | node - <target>
 *
 * Targets:
 *   openapi          OpenAPI JSON + YAML (production)
 *   openapi-sandbox  OpenAPI JSON + YAML (sandbox)
 *   postman          Postman collection + sandbox/production environments
 *   sdk-node         Node SDK manifest + README
 *   sdk-php          PHP SDK manifest + README
 *   sdk-python       Python SDK pyproject + README
 *   all              every artifact listed in /artifacts.json
 *
 * Behaviour:
 *   1. Fetch /artifacts.json from --base (default https://kangopenbanking.com)
 *   2. Download each requested artifact + its .sig
 *   3. Verify SHA-256 against the published checksum
 *   4. Verify Ed25519 signature against /artifact-signing-pubkey.pem
 *   5. Print resolved versions in a summary table
 *
 * Flags:
 *   --base <url>     override base URL (default https://kangopenbanking.com)
 *   --out  <dir>     output directory (default ./kob-artifacts)
 *   --no-verify-sig  skip signature check (checksum still enforced)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  return args[i + 1];
}
const HAS = (n) => args.includes(n);

const BASE = (flag('--base') || process.env.KOB_BASE || 'https://kangopenbanking.com').replace(/\/+$/, '');
const OUT = path.resolve(flag('--out') || 'kob-artifacts');
const NO_SIG = HAS('--no-verify-sig');
const TARGETS = args.filter((a) => !a.startsWith('--') && !['--base', '--out'].includes(args[args.indexOf(a) - 1]));
if (TARGETS.length === 0) TARGETS.push('all');

const CATEGORIES = {
  openapi: ['openapi'],
  'openapi-sandbox': ['openapi-sandbox'],
  postman: ['postman', 'postman-env'],
  'sdk-node': ['sdk-node'],
  'sdk-php': ['sdk-php'],
  'sdk-python': ['sdk-python'],
  changelog: ['changelog'],
  all: null, // sentinel
};

async function getBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function importPemPub(pem) {
  return crypto.createPublicKey({ key: pem, format: 'pem' });
}

(async () => {
  console.log(`kob-fetch · base=${BASE} · out=${OUT}`);
  fs.mkdirSync(OUT, { recursive: true });

  const metaUrl = `${BASE}/artifacts.json`;
  const meta = JSON.parse((await getBuffer(metaUrl)).toString('utf8'));

  let pub = null;
  if (!NO_SIG && meta.signing?.publicKeyUrl) {
    const pemBuf = await getBuffer(`${BASE}${meta.signing.publicKeyUrl}`);
    pub = importPemPub(pemBuf.toString('utf8'));
  }

  const wanted = new Set();
  for (const t of TARGETS) {
    if (t === 'all') { meta.artifacts.forEach((a) => wanted.add(a.url)); continue; }
    const cats = CATEGORIES[t];
    if (!cats) { console.error(`Unknown target: ${t}`); process.exit(2); }
    for (const a of meta.artifacts) if (cats.includes(a.category)) wanted.add(a.url);
  }
  if (wanted.size === 0) { console.error('No matching artifacts.'); process.exit(2); }

  const summary = [];
  for (const a of meta.artifacts) {
    if (!wanted.has(a.url)) continue;
    const buf = await getBuffer(`${BASE}${a.url}`);
    const digest = sha256(buf);
    const sumOk = digest === a.sha256;
    let sigOk = null;
    if (pub && a.signature?.sigUrl) {
      const sigB64 = (await getBuffer(`${BASE}${a.signature.sigUrl}`)).toString('utf8').trim();
      sigOk = crypto.verify(null, buf, pub, Buffer.from(sigB64, 'base64'));
    }
    if (!sumOk) { console.error(`✗ ${a.url} sha256 mismatch`); process.exit(1); }
    if (sigOk === false) { console.error(`✗ ${a.url} signature invalid`); process.exit(1); }

    const dst = path.join(OUT, a.url.replace(/^\//, ''));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, buf);
    summary.push({
      artifact: a.url,
      category: a.category,
      version: a.version,
      bytes: a.size,
      sha256: a.sha256.slice(0, 12) + '…',
      sig: sigOk === null ? 'skipped' : sigOk ? 'ok' : 'fail',
    });
  }

  console.log('\nDownloaded & verified:');
  console.table(summary);
  console.log(`\nSSOT: API v${meta.ssot.apiVersion} · SDKs node@${meta.ssot.sdkVersions.node} ` +
    `php@${meta.ssot.sdkVersions.php} python@${meta.ssot.sdkVersions.python}`);
  console.log(`Release notes: ${BASE}${meta.releaseNotesUrl || '/sdk-downloads/SDK_RELEASE_NOTES.md'}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
