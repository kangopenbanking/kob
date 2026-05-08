#!/usr/bin/env node
/**
 * snapshot-openapi-history.mjs
 *
 * Idempotent snapshotter that captures the current build of
 * `public/openapi.json` into `public/openapi-history/openapi-<version>.json`
 * and registers it in `public/openapi-history/manifest.json` so the
 * /v1/spec/diff endpoint, the developer portal, and the breaking-change
 * regression test can compare versions byte-for-byte.
 *
 * Behaviour
 *   1. Reads `public/openapi.json` info.version (the build output).
 *   2. If the snapshot file does not exist, copies the current spec into
 *      `public/openapi-history/openapi-<version>.json`.
 *   3. Upserts the manifest entry as { type: "snapshot", file, released_at,
 *      notes } and sets `manifest.current` to that version.
 *   4. Pulls a one-line `notes` field from the matching `public/changelog.json`
 *      entry (summary), so the manifest stays consistent with the changelog.
 *
 * Safe to run on every CI build, every commit hook, and as part of
 * `scripts/sync-version-artifacts.mjs`.
 *
 * Justification: Standing Order 6 (Version Gate), ORDER P7 (Changelog Rule),
 * ORDER P10 (Living Docs Rule).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SPEC_PATH = path.join(ROOT, 'public/openapi.json');
const HISTORY_DIR = path.join(ROOT, 'public/openapi-history');
const MANIFEST_PATH = path.join(HISTORY_DIR, 'manifest.json');
const CHANGELOG_PATH = path.join(ROOT, 'public/changelog.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n'); }
function fail(msg) { console.error(`::error::${msg}`); process.exit(1); }

if (!fs.existsSync(SPEC_PATH)) fail('public/openapi.json missing');
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

const spec = readJson(SPEC_PATH);
const version = spec?.info?.version;
if (!version) fail('public/openapi.json info.version missing');

const snapshotFile = `openapi-${version}.json`;
const snapshotPath = path.join(HISTORY_DIR, snapshotFile);

// 1. Snapshot the spec (write only if missing or content changed)
let copied = false;
const incoming = JSON.stringify(spec, null, 2) + '\n';
if (!fs.existsSync(snapshotPath)) {
  fs.writeFileSync(snapshotPath, incoming);
  copied = true;
} else {
  const existing = fs.readFileSync(snapshotPath, 'utf8');
  if (existing !== incoming) {
    // Spec for the same version changed — overwrite. The version-gate +
    // breaking-change tests are responsible for refusing illegal in-place
    // edits; this script just keeps history honest.
    fs.writeFileSync(snapshotPath, incoming);
    copied = true;
  }
}

// 2. Upsert manifest
let manifest;
if (fs.existsSync(MANIFEST_PATH)) {
  manifest = readJson(MANIFEST_PATH);
} else {
  manifest = {
    _comment:
      "Manifest of OpenAPI version snapshots. 'snapshot' entries have a full JSON file; 'changelog_only' entries point to the human changelog.",
    current: version,
    versions: [],
  };
}

// Pull notes from changelog.json if the entry exists
let notes = '';
if (fs.existsSync(CHANGELOG_PATH)) {
  const cl = readJson(CHANGELOG_PATH);
  const entry = (cl.entries || []).find((e) => e.version === version);
  if (entry?.summary) notes = String(entry.summary).trim();
}

const idx = (manifest.versions || []).findIndex((v) => v.version === version);
const entryRecord = {
  version,
  released_at: new Date().toISOString(),
  type: 'snapshot',
  file: snapshotFile,
  notes: notes || `Snapshot for v${version}`,
};

if (idx === -1) {
  // Newest at the top
  manifest.versions.unshift(entryRecord);
} else {
  // Preserve the original released_at if already a snapshot
  if (manifest.versions[idx].type === 'snapshot' && manifest.versions[idx].released_at) {
    entryRecord.released_at = manifest.versions[idx].released_at;
  }
  manifest.versions[idx] = entryRecord;
}

manifest.current = version;
writeJson(MANIFEST_PATH, manifest);

console.log(
  `snapshot-openapi-history: v${version} · ${copied ? 'snapshot written' : 'snapshot already current'} · manifest.current=${version}`,
);
