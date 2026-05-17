#!/usr/bin/env node
/**
 * SEO/OG image audit + coverage report.
 *
 * - Walks dist/**\/*.html (post-build, including prerendered docs routes).
 * - For each HTML file, extracts canonical, og:image, twitter:image, twitter:card.
 * - Fails the build (exit 1) if any page is missing og:image / twitter:image,
 *   uses a non-kangopenbanking.com (third-party) host, or is not a /images/* PNG.
 * - Writes a coverage report to dist/reports/og-coverage.json and a Markdown
 *   summary to dist/reports/og-coverage.md for human review.
 *
 * Justification: Developer Portal Guardian Orders P1, P2, P6 + brand control.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ALLOWED_HOST = 'kangopenbanking.com';
const REQUIRED_PATH_PREFIX = '/images/';

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function pick(re, html) {
  const m = html.match(re);
  return m ? m[1] : null;
}

function auditFile(file) {
  const html = fs.readFileSync(file, 'utf-8');
  const route = '/' + path.relative(DIST, file).replace(/\\/g, '/').replace(/index\.html$/, '').replace(/\.html$/, '').replace(/\/$/, '');
  const data = {
    file: path.relative(ROOT, file),
    route: route === '' ? '/' : route,
    canonical: pick(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i, html),
    ogImage: pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i, html),
    twitterImage: pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i, html),
    twitterCard: pick(/<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']+)["']/i, html),
    ogWidth: pick(/<meta[^>]+property=["']og:image:width["'][^>]+content=["']([^"']+)["']/i, html),
    ogHeight: pick(/<meta[^>]+property=["']og:image:height["'][^>]+content=["']([^"']+)["']/i, html),
  };
  const errors = [];
  for (const key of ['ogImage', 'twitterImage']) {
    const val = data[key];
    if (!val) { errors.push(`missing ${key}`); continue; }
    try {
      const u = new URL(val);
      if (u.hostname !== ALLOWED_HOST) errors.push(`${key} third-party host: ${u.hostname}`);
      if (!u.pathname.startsWith(REQUIRED_PATH_PREFIX)) errors.push(`${key} not under /images/: ${u.pathname}`);
      if (!/\.(png|jpe?g|webp)$/i.test(u.pathname)) errors.push(`${key} not an image: ${u.pathname}`);
    } catch {
      errors.push(`${key} not an absolute URL: ${val}`);
    }
  }
  if (data.twitterCard !== 'summary_large_image') errors.push(`twitter:card must be summary_large_image (got ${data.twitterCard})`);
  if (data.ogWidth !== '1200' || data.ogHeight !== '630') errors.push(`og:image dimensions must be 1200x630 (got ${data.ogWidth}x${data.ogHeight})`);
  data.errors = errors;
  return data;
}

if (!fs.existsSync(DIST)) {
  console.error(`[audit-meta-images] dist/ not found at ${DIST}. Run \`vite build\` first.`);
  process.exit(2);
}

const files = walk(DIST);
const results = files.map(auditFile);
const failing = results.filter(r => r.errors.length > 0);

const reportsDir = path.join(DIST, 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
fs.writeFileSync(
  path.join(reportsDir, 'og-coverage.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), total: results.length, failing: failing.length, results }, null, 2)
);

const md = [
  `# OG/Twitter Image Coverage`,
  ``,
  `Generated: ${new Date().toISOString()}`,
  `Total HTML pages scanned: **${results.length}**`,
  `Pages with errors: **${failing.length}**`,
  ``,
  `| Route | og:image | twitter:image | twitter:card | Errors |`,
  `|-------|----------|---------------|--------------|--------|`,
  ...results
    .sort((a, b) => a.route.localeCompare(b.route))
    .map(r => `| ${r.route} | ${r.ogImage || '—'} | ${r.twitterImage || '—'} | ${r.twitterCard || '—'} | ${r.errors.join('; ') || 'OK'} |`),
].join('\n');
fs.writeFileSync(path.join(reportsDir, 'og-coverage.md'), md);

console.log(`[audit-meta-images] scanned ${results.length} HTML files; ${failing.length} failing.`);
console.log(`[audit-meta-images] reports written to dist/reports/og-coverage.{json,md}`);

if (failing.length > 0) {
  console.error('\n[audit-meta-images] FAILURES:');
  for (const r of failing) {
    console.error(`  ${r.route}`);
    for (const e of r.errors) console.error(`    - ${e}`);
  }
  process.exit(1);
}
