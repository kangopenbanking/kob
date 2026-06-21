#!/usr/bin/env node
/**
 * Post-deploy smoke test for Vercel production.
 *
 * Verifies the permanent public routes (Standing Orders P1/P2/P4):
 *   - /developer and key sub-routes return 200 HTML
 *   - /openapi.json + /openapi.yaml return correct content-type and parse
 *   - /changelog.json, /apis.json, /.well-known/ai-plugin.json are reachable
 *
 * Usage: node scripts/vercel-postdeploy-smoke.mjs [base-url]
 */
import { parse as parseYaml } from 'yaml';

const BASE = (process.argv[2] || process.env.VERCEL_PROD_URL || 'https://kangopenbanking.com').replace(/\/$/, '');

const HTML_ROUTES = [
  '/developer',
  '/developer/quickstart',
  '/developer/api-reference',
  '/developer/sdks',
  '/developer/changelog',
];

const JSON_ROUTES = [
  { path: '/openapi.json', contains: '"openapi"' },
  { path: '/openapi-sandbox.json', contains: '"openapi"' },
  { path: '/apis.json', contains: '"apis"' },
  { path: '/changelog.json', optional: true },
  { path: '/.well-known/ai-plugin.json', optional: true },
];

const YAML_ROUTES = ['/openapi.yaml'];

let failed = 0;
const log = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failed++;
};

async function head(url) {
  const r = await fetch(url, { method: 'GET', redirect: 'manual' });
  return r;
}

console.log(`Smoke target: ${BASE}\n`);

for (const route of HTML_ROUTES) {
  try {
    const r = await head(BASE + route);
    const ct = r.headers.get('content-type') || '';
    const ok = r.status === 200 && ct.includes('text/html');
    log(ok, `GET ${route} -> ${r.status} (${ct})`);
  } catch (e) {
    log(false, `GET ${route} -> ${e.message}`);
  }
}

for (const { path, contains, optional } of JSON_ROUTES) {
  try {
    const r = await fetch(BASE + path);
    if (optional && r.status === 404) {
      log(true, `GET ${path} -> 404 (optional, skipped)`);
      continue;
    }
    const ct = r.headers.get('content-type') || '';
    const body = await r.text();
    let parsed = false;
    try { JSON.parse(body); parsed = true; } catch {}
    const ok = r.status === 200 && ct.includes('json') && parsed && (!contains || body.includes(contains));
    log(ok, `GET ${path} -> ${r.status} (${ct}) parsed=${parsed}`);
  } catch (e) {
    log(false, `GET ${path} -> ${e.message}`);
  }
}

for (const path of YAML_ROUTES) {
  try {
    const r = await fetch(BASE + path);
    const ct = r.headers.get('content-type') || '';
    const body = await r.text();
    let parsed = false;
    try { parseYaml(body); parsed = true; } catch {}
    const ok = r.status === 200 && /yaml|yml|text\/plain/.test(ct) && parsed;
    log(ok, `GET ${path} -> ${r.status} (${ct}) parsed=${parsed}`);
  } catch (e) {
    log(false, `GET ${path} -> ${e.message}`);
  }
}

console.log(`\n${failed === 0 ? 'All smoke checks passed.' : `${failed} smoke check(s) failed.`}`);
process.exit(failed === 0 ? 0 : 1);
