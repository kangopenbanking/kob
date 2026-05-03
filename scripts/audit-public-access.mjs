#!/usr/bin/env node
/**
 * Public-access E2E auditor for the developer documentation surface.
 *
 * Verifies (Order P1, P2, P4, P6 + Standing Order 6):
 *   - Every documented URL returns HTTP 200 to anonymous Googlebot.
 *   - No `X-Robots-Tag: noindex`, no `<meta name="robots" content="noindex">`.
 *   - No SPA-shell-only responses on /developer/* (must have prerendered text).
 *   - /openapi.json is the expected version with > 100 paths.
 *   - /changelog.json apiVersion matches.
 *   - JSON/YAML endpoints advertise correct Content-Type.
 *
 * Usage: node scripts/audit-public-access.mjs [https://host]
 * CI:    fails (exit 1) on any failure.
 */
import { resolveExpectedVersion } from './lib/read-expected-version.mjs';

const BASE = process.argv[2] || process.env.AUDIT_BASE || 'https://kangopenbanking.com';
const EXPECTED_VERSION = resolveExpectedVersion();

const URLS = [
  '/developer',
  '/developer/getting-started',
  '/developer/api-explorer',
  '/developer/api-explorer-static',
  '/developer/gateway/quickstart',
  '/developer/gateway/webhooks',
  '/developer/sandbox/overview',
  '/developer/guides/sdks',
  '/developer/examples/real-world',
  '/developer/changelog',
  '/developer/authentication/dcr',
  '/developer/open-banking/standards',
  '/openapi.json',
  '/openapi.yaml',
  '/openapi-sandbox.json',
  '/changelog.json',
  '/apis.json',
  '/.well-known/ai-plugin.json',
  '/sitemap.xml',
  '/robots.txt',
];

const UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const results = [];
let failed = 0;

for (const path of URLS) {
  const url = `${BASE}${path}`;
  const issues = [];
  let status = 0, ctype = '', xrobots = '', body = '';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    status = res.status;
    ctype = (res.headers.get('content-type') || '').toLowerCase();
    xrobots = (res.headers.get('x-robots-tag') || '').toLowerCase();
    body = await res.text();
  } catch (e) {
    issues.push(`fetch_error:${e.message}`);
  }

  if (status !== 200) issues.push(`status:${status}`);
  if (xrobots.includes('noindex')) issues.push('x-robots:noindex');
  if (path.endsWith('.json') && !ctype.includes('json')) issues.push(`ctype:${ctype}`);
  if (path.endsWith('.yaml') && !/(yaml|yml)/.test(ctype)) issues.push(`ctype:${ctype}`);

  if (path.startsWith('/developer') && status === 200) {
    if (body.includes('<div id="ssr-fallback"')) issues.push('ssr-fallback-leak');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(body)) issues.push('meta:noindex');
    const text = stripHtml(body);
    if (text.length < 600) issues.push(`thin-content:${text.length}`);
  }

  if (path === '/openapi.json' && status === 200) {
    try {
      const spec = JSON.parse(body);
      if (spec.info?.version !== EXPECTED_VERSION) issues.push(`spec-version:${spec.info?.version}`);
      const pc = Object.keys(spec.paths || {}).length;
      if (pc < 100) issues.push(`spec-paths:${pc}`);
    } catch { issues.push('spec-parse-fail'); }
  }
  if (path === '/changelog.json' && status === 200) {
    try {
      const cl = JSON.parse(body);
      if (cl.apiVersion !== EXPECTED_VERSION) issues.push(`changelog-version:${cl.apiVersion}`);
    } catch { issues.push('changelog-parse-fail'); }
  }

  if (issues.length) failed++;
  results.push({ path, status, ctype, issues });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`Public-access audit  ·  base=${BASE}  ·  expected v${EXPECTED_VERSION}`);
console.log(pad('STATUS', 7) + pad('CTYPE', 26) + pad('PATH', 42) + 'ISSUES');
console.log('-'.repeat(110));
for (const r of results) {
  console.log(
    pad(r.status, 7) + pad(r.ctype.split(';')[0] || '?', 26) +
    pad(r.path, 42) + (r.issues.length ? r.issues.join(' ') : 'OK')
  );
}
console.log('-'.repeat(110));
if (failed) {
  console.error(`FAIL · ${failed}/${results.length} URL(s) failed`);
  process.exit(1);
}
console.log(`PASS · ${results.length}/${results.length} URL(s) healthy`);
