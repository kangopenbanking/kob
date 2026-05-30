#!/usr/bin/env node
/**
 * kob-verify-keys — verify every published Kang Open Banking artifact against
 * the CURRENT and (if present) STAGED NEXT Ed25519 public keys.
 *
 * Mirrors the exact logic of scripts/verify-artifact-signatures.mjs in CI, so
 * an integrator running this CLI is testing the same invariants the portal
 * enforces before every deploy.
 *
 * Usage (no install required):
 *   curl -sSL https://kangopenbanking.com/scripts/kob-verify-keys.mjs | node -
 *   curl -sSL https://kangopenbanking.com/scripts/kob-verify-keys.mjs | node - --base https://kangopenbanking.com
 *   curl -sSL https://kangopenbanking.com/scripts/kob-verify-keys.mjs | node - --pin SHA256:abc…
 *
 * Flags:
 *   --base <url>   override base URL (default https://kangopenbanking.com)
 *   --pin <fp>     fail unless current fingerprint equals this value
 *                  (repeatable; any match passes — useful during rotation)
 *   --json         emit machine-readable summary on stdout
 *   --quiet        suppress per-artifact lines (only summary + failures)
 *
 * Exit codes:
 *   0 — all signatures valid for every loaded key
 *   1 — at least one signature missing/invalid, or pin mismatch
 *   2 — network / metadata fetch error
 */
import crypto from 'node:crypto';

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
function flagAll(name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1] && !args[i + 1].startsWith('--')) out.push(args[++i]);
  }
  return out;
}

const BASE = (flag('--base', 'https://kangopenbanking.com') + '').replace(/\/+$/, '');
const PINS = flagAll('--pin');
const JSON_OUT = !!flag('--json', false);
const QUIET = !!flag('--quiet', false);

const log = (...a) => { if (!JSON_OUT && !QUIET) console.log(...a); };
const warn = (...a) => { if (!JSON_OUT) console.error(...a); };

async function getBuf(path) {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`GET ${path} → HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
async function getText(path) { return (await getBuf(path)).toString('utf8'); }
async function getJson(path) { return JSON.parse(await getText(path)); }

function loadKey(pem) {
  const key = crypto.createPublicKey({ key: pem, format: 'pem' });
  const der = key.export({ type: 'spki', format: 'der' });
  const fp = 'SHA256:' + crypto.createHash('sha256').update(der).digest('base64').replace(/=+$/, '');
  return { key, fp };
}

async function main() {
  let meta;
  try {
    meta = await getJson('/artifacts.json');
  } catch (e) {
    warn(`FAIL: could not fetch /artifacts.json from ${BASE}: ${e.message}`);
    process.exit(2);
  }

  const currentPem = await getText(meta.signing?.publicKeyUrl || '/artifact-signing-pubkey.pem');
  const current = loadKey(currentPem);
  log(`Base:    ${BASE}`);
  log(`Current: ${current.fp}`);

  let next = null;
  if (meta.signing?.next?.publicKeyUrl) {
    try {
      const nextPem = await getText(meta.signing.next.publicKeyUrl);
      next = loadKey(nextPem);
      log(`Staged:  ${next.fp} (${meta.signing.next.status || 'staged'})`);
    } catch (e) {
      warn(`WARN: staged next key advertised but unreachable: ${e.message}`);
    }
  }

  if (PINS.length && !PINS.includes(current.fp) && !(next && PINS.includes(next.fp))) {
    warn(`FAIL: current fingerprint ${current.fp} matches none of --pin ${PINS.join(', ')}`);
    process.exit(1);
  }

  let ok = 0, fail = 0, okNext = 0, failNext = 0;
  const failures = [];

  for (const art of meta.artifacts) {
    const url = art.url;
    let body, sig;
    try {
      [body, sig] = await Promise.all([
        getBuf(url),
        getText(art.signature?.sigUrl || `${url}.sig`),
      ]);
    } catch (e) {
      fail++;
      failures.push({ url, key: 'current', reason: e.message });
      warn(`FAIL ${url} (current): ${e.message}`);
      continue;
    }
    const sha = crypto.createHash('sha256').update(body).digest('hex');
    if (art.sha256 && sha !== art.sha256) {
      fail++;
      failures.push({ url, key: 'current', reason: `sha256 mismatch (got ${sha})` });
      warn(`FAIL ${url} (current): sha256 mismatch`);
      continue;
    }
    const valid = crypto.verify(null, body, current.key, Buffer.from(sig.trim(), 'base64'));
    if (valid) {
      ok++;
      if (!QUIET && !JSON_OUT) log(`  ok  ${url}`);
    } else {
      fail++;
      failures.push({ url, key: 'current', reason: 'invalid signature' });
      warn(`FAIL ${url} (current): invalid signature`);
    }

    if (next && art.signature?.nextSigUrl) {
      try {
        const sigN = await getText(art.signature.nextSigUrl);
        const validN = crypto.verify(null, body, next.key, Buffer.from(sigN.trim(), 'base64'));
        if (validN) okNext++;
        else { failNext++; failures.push({ url, key: 'next', reason: 'invalid signature' }); warn(`FAIL ${url} (next): invalid`); }
      } catch (e) {
        failNext++;
        failures.push({ url, key: 'next', reason: e.message });
        warn(`FAIL ${url} (next): ${e.message}`);
      }
    }
  }

  const summary = {
    base: BASE,
    generatedAt: meta.generatedAt,
    current: { fingerprint: current.fp, ok, fail },
    next: next ? { fingerprint: next.fp, ok: okNext, fail: failNext } : null,
    artifacts: meta.artifacts.length,
    failures,
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    log('');
    log(`Current key: ${ok} ok, ${fail} failed.`);
    if (next) log(`Next key:    ${okNext} ok, ${failNext} failed.`);
  }
  process.exit(fail === 0 && failNext === 0 ? 0 : 1);
}

main().catch((e) => { warn(`FATAL: ${e.message}`); process.exit(2); });
