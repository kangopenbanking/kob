#!/usr/bin/env node
/**
 * Build/refresh the machine-readable index in public/changelog.json.
 * Additive only: leaves existing keys untouched, adds `schema_version` and `index`.
 *
 * Usage:  node scripts/build-changelog-index.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.cwd(), 'public/changelog.json');
const data = JSON.parse(readFileSync(file, 'utf-8'));

if (!Array.isArray(data.entries)) {
  console.error('changelog.json: entries[] missing');
  process.exit(1);
}

const byVersion = {};
const byDate = {};

data.entries.forEach((e, offset) => {
  const slim = {
    date: e.date,
    type: e.type ?? null,
    breaking_changes: !!e.breaking_changes,
    summary: e.summary ?? e.title ?? '',
    entry_offset: offset,
  };
  if (e.version) byVersion[e.version] = slim;
  if (e.date) {
    byDate[e.date] = byDate[e.date] || [];
    if (e.version && !byDate[e.date].includes(e.version)) byDate[e.date].push(e.version);
  }
});

const latest = data.entries[0] || null;

data.schema_version = '1.1';
data.index = {
  by_version: byVersion,
  by_date: byDate,
  latest: latest
    ? { version: latest.version, date: latest.date, entry_offset: 0 }
    : null,
  total_entries: data.entries.length,
  generated_at: new Date().toISOString(),
};

writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(
  `changelog.json index built: ${data.entries.length} entries, latest=${latest?.version}`
);
