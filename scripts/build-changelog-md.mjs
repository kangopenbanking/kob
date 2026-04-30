#!/usr/bin/env node
/**
 * Build a human-readable Markdown changelog from public/changelog.json.
 *
 * - Source of truth: public/changelog.json (machine-readable, edited per release).
 * - Outputs:
 *     public/CHANGELOG.md  — served at https://kangopenbanking.com/CHANGELOG.md
 *                            (ORDER P7 — publicly accessible, no login).
 *     CHANGELOG.md         — repo-root mirror, useful for GitHub viewers.
 *
 * Run via `npm run changelog:md` (or as part of CI on every release).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = resolve(process.cwd(), 'public/changelog.json');
const data = JSON.parse(readFileSync(src, 'utf8'));

if (!Array.isArray(data.entries)) {
  console.error('public/changelog.json: entries[] missing');
  process.exit(1);
}

const lines = [];
lines.push('# Kang Open Banking — API Changelog');
lines.push('');
lines.push(
  `Current API version: **${data.apiVersion ?? 'unknown'}** · ` +
  `Last updated: **${data.lastUpdated ?? 'unknown'}**`,
);
lines.push('');
lines.push(
  '> Source of truth is [`public/changelog.json`](./changelog.json). ' +
  'This Markdown file is regenerated from it (`npm run changelog:md`). ' +
  'See ORDER P7 (Changelog Rule) — every API change must be documented within 48 hours of deployment.',
);
lines.push('');
lines.push(`- OpenAPI spec: [\`/openapi.json\`](./openapi.json) · [\`/openapi.yaml\`](./openapi.yaml)`);
lines.push(`- Sandbox spec: [\`/openapi-sandbox.json\`](./openapi-sandbox.json) · [\`/openapi-sandbox.yaml\`](./openapi-sandbox.yaml)`);
lines.push('- Browse online: <https://kangopenbanking.com/developer/changelog>');
lines.push('');
lines.push('---');
lines.push('');

for (const e of data.entries) {
  const head = `## ${e.version ?? '(unversioned)'} — ${e.date ?? 'unreleased'}`;
  lines.push(head);
  if (e.type) {
    lines.push(
      `**Type:** ${e.type} · **Breaking changes:** ${e.breaking_changes ? 'YES' : 'none'}`,
    );
  }
  lines.push('');
  if (e.summary) {
    lines.push(e.summary);
    lines.push('');
  }
  if (Array.isArray(e.highlights) && e.highlights.length) {
    lines.push('### Highlights');
    for (const h of e.highlights) lines.push(`- ${h}`);
    lines.push('');
  }
  if (Array.isArray(e.additions) && e.additions.length) {
    lines.push('### Added');
    for (const x of e.additions) lines.push(`- ${x}`);
    lines.push('');
  }
  if (Array.isArray(e.fixes) && e.fixes.length) {
    lines.push('### Fixed');
    for (const x of e.fixes) lines.push(`- ${x}`);
    lines.push('');
  }
  if (Array.isArray(e.deprecations) && e.deprecations.length) {
    lines.push('### Deprecated');
    for (const x of e.deprecations) lines.push(`- ${x}`);
    lines.push('');
  }
  if (Array.isArray(e.standard_citations) && e.standard_citations.length) {
    lines.push('### Standards & citations');
    for (const x of e.standard_citations) lines.push(`- ${x}`);
    lines.push('');
  }
  if (e.migration_notes) {
    lines.push('### Migration notes');
    lines.push(typeof e.migration_notes === 'string' ? e.migration_notes : JSON.stringify(e.migration_notes, null, 2));
    lines.push('');
  }
  lines.push('---');
  lines.push('');
}

const md = lines.join('\n');
writeFileSync(resolve(process.cwd(), 'public/CHANGELOG.md'), md);
writeFileSync(resolve(process.cwd(), 'CHANGELOG.md'), md);
console.log(`Wrote public/CHANGELOG.md and CHANGELOG.md (${data.entries.length} entries, version ${data.apiVersion}).`);
