#!/usr/bin/env node
/**
 * Developer & info portal link checker (Standing Order P2 — ZERO-404 RULE).
 *
 * Walks every documented public route under /developer/* and /info/* derived
 * from src/App.tsx and src/pages/developer/**, plus URLs declared in
 * public/openapi.json (info.* + tags[].externalDocs + x-sdk-libraries[].docs).
 *
 * FAILS the build if any URL:
 *   - returns >= 400
 *   - 3xx-redirects to "/" or to a homepage path (drop-to-home regression)
 *
 * Uses HEAD then GET-on-non-200 to dodge anti-bot blocks (npm.com returns 403
 * to HEAD but 200 to GET in a browser); both methods must fail before we flag.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.DOCS_BASE_URL || 'https://kangopenbanking.com').replace(/\/+$/, '');
const CONCURRENCY = 8;
const TIMEOUT_MS = 12_000;
const UA = 'KOB-link-check/1.0 (+https://kangopenbanking.com)';

// ---- collect internal routes ----
const internal = new Set();

// 1. src/App.tsx — every <Route path="..."> that starts with /developer or /info
const app = fs.readFileSync('src/App.tsx', 'utf8');
for (const m of app.matchAll(/path="(\/(?:developer|info)[^"*:]*)"/g)) internal.add(m[1]);

// 2. mandatory always-on documentation roots
for (const p of ['/developer', '/developer/getting-started', '/developer/quickstart',
                 '/developer/api-explorer', '/openapi.json', '/openapi.yaml',
                 '/openapi-sandbox.json', '/openapi-sandbox.yaml',
                 '/postman/manifest.json', '/changelog.json']) internal.add(p);

// ---- collect external URLs from openapi.json ----
const spec = JSON.parse(fs.readFileSync('public/openapi.json', 'utf8'));
const external = new Set();
const info = spec.info || {};
if (info.termsOfService) external.add(info.termsOfService);
for (const v of Object.values(info.contact || {})) if (typeof v === 'string' && v.startsWith('http')) external.add(v);
for (const v of Object.values(info.license || {})) if (typeof v === 'string' && v.startsWith('http')) external.add(v);
for (const sdk of Object.values(info['x-sdk-libraries'] || {})) {
  for (const v of Object.values(sdk)) if (typeof v === 'string' && v.startsWith('http')) external.add(v);
}
for (const t of spec.tags || []) {
  const u = t.externalDocs?.url;
  if (u && u.startsWith('http')) external.add(u);
}

// ---- probe ----
async function probe(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    let r = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: ac.signal, headers: { 'User-Agent': UA } });
    if (r.status === 405 || r.status === 403 || r.status === 501) {
      r = await fetch(url, { method: 'GET', redirect: 'manual', signal: ac.signal, headers: { 'User-Agent': UA, Accept: 'text/html,application/json,*/*' } });
    }
    const loc = r.headers.get('location') || '';
    let redirectFlag = '';
    if (r.status >= 300 && r.status < 400) {
      const dest = new URL(loc, url).pathname;
      if (dest === '/' || dest === '/index.html') redirectFlag = `REDIRECTS-TO-HOMEPAGE (${loc})`;
    }
    return { url, status: r.status, redirectFlag };
  } catch (e) {
    return { url, status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(t); }
}

const queue = [
  ...[...internal].map(p => BASE + p),
  ...external,
];

console.log(`Checking ${queue.length} URLs (base=${BASE})…`);
const results = [];
let cursor = 0;
async function worker() {
  while (cursor < queue.length) {
    const u = queue[cursor++];
    const r = await probe(u);
    results.push(r);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const fails = results.filter(r => r.status === 0 || r.status >= 400 || r.redirectFlag);
// npm.com returns 403 to scripted HEAD/GET — treat as soft-pass when it's an /package/ URL.
const SOFT_403 = (r) => r.status === 403 && /npmjs\.com\/package\//.test(r.url);
const hardFails = fails.filter(r => !SOFT_403(r));

console.log('\n--- Results ---');
for (const r of results.sort((a,b)=>String(a.status).localeCompare(String(b.status)))) {
  const tag = (r.status === 0) ? `ERR(${r.error})`
            : (r.redirectFlag) ? `WARN-${r.status}-${r.redirectFlag}`
            : (r.status >= 400 && !SOFT_403(r)) ? `FAIL-${r.status}`
            : (SOFT_403(r)) ? `SOFT-403`
            : `OK-${r.status}`;
  console.log(`${tag.padEnd(20)} ${r.url}`);
}
console.log(`\nTotal: ${results.length}   Fails: ${hardFails.length}   Soft-403 (npm scrape): ${fails.length - hardFails.length}`);

if (hardFails.length) {
  console.error(`\nLINK CHECK FAILED — ${hardFails.length} hard failure(s).`);
  process.exit(1);
}
console.log('\nOK — every documented link reachable and none redirect to homepage.');
