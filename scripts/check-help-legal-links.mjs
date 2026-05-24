#!/usr/bin/env node
/**
 * check-help-legal-links.mjs
 *
 * Order P2 — THE ZERO-404 RULE enforcement.
 * Crawls the public help/legal/support routes plus the in-app Help quick-links
 * and asserts each one returns HTTP 200 with non-trivial HTML (not a redirect
 * to "/" and not an SPA shell that throws).
 *
 * Wired into the predeploy gate and the dedicated GitHub workflow so a broken
 * Help/Legal link can never reach production.
 *
 * Usage:
 *   AUDIT_BASE=https://kob.lovable.app node scripts/check-help-legal-links.mjs
 */

const BASE = (process.env.AUDIT_BASE || 'https://kob.lovable.app').replace(/\/$/, '');

// PERMANENT — these routes must always serve real content (P1, P2, P6).
const ROUTES = [
  '/help-centre',
  '/faq',
  '/terms',
  '/privacy',
  '/contact',
  '/security-policy',
  '/.well-known/security.txt',
];

// Strings that indicate the SPA crashed or fell back to a generic 404 shell.
const FORBIDDEN_MARKERS = [
  'Oops! Page not found',
  '404 Error',
  'We encountered an unexpected error',
];

let failed = 0;
const results = [];

async function check(path) {
  const url = `${BASE}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'KOB-link-health/1.0' },
    });
    const elapsed = Date.now() - start;
    const text = res.status === 200 ? await res.text() : '';
    const tooShort = text.length < 500;
    const marker = FORBIDDEN_MARKERS.find((m) => text.includes(m));
    const isRedirect = res.status >= 300 && res.status < 400;

    const ok = res.status === 200 && !tooShort && !marker;
    results.push({ path, status: res.status, ms: elapsed, ok, tooShort, marker, isRedirect });
    if (!ok) failed++;
  } catch (err) {
    results.push({ path, status: 'ERR', error: err.message, ok: false });
    failed++;
  }
}

console.log(`Help/Legal link health · base=${BASE}`);
for (const r of ROUTES) {
  // eslint-disable-next-line no-await-in-loop
  await check(r);
}

for (const r of results) {
  const sym = r.ok ? '✓' : '✗';
  const detail = r.ok
    ? `${r.status} (${r.ms}ms)`
    : `${r.status}${r.isRedirect ? ' REDIRECT' : ''}${r.tooShort ? ' EMPTY' : ''}${r.marker ? ` "${r.marker}"` : ''}${r.error ? ` ${r.error}` : ''}`;
  console.log(`  ${sym} ${r.path.padEnd(28)} ${detail}`);
}

if (failed > 0) {
  console.error(`\n${failed} link(s) failed health check. Order P2 (Zero-404) violation — blocking deploy.`);
  process.exit(1);
}
console.log(`\nAll ${ROUTES.length} help/legal routes healthy.`);
