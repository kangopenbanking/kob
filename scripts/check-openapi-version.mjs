#!/usr/bin/env node
/**
 * CI gate: verify public/openapi.json metadata matches the expected v4.28.2
 * baseline. Fails the build if the spec version, openapi version, or required
 * info fields are missing or stale.
 *
 * Justification: Standing Order 6 (The Version Gate) + Order P7 (Changelog Rule).
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveExpectedVersion } from './lib/read-expected-version.mjs';

const EXPECTED_VERSION = resolveExpectedVersion();
const EXPECTED_OPENAPI = '3.1.0';
const SPEC_PATH = path.resolve(process.cwd(), 'public/openapi.json');
const CHANGELOG_PATH = path.resolve(process.cwd(), 'public/changelog.json');

function fail(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

if (!fs.existsSync(SPEC_PATH)) fail(`public/openapi.json not found`);
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf-8'));

if (spec.openapi !== EXPECTED_OPENAPI) {
  fail(`Expected openapi='${EXPECTED_OPENAPI}', got '${spec.openapi}'`);
}
if (!spec.info?.version) fail(`info.version missing`);
if (spec.info.version !== EXPECTED_VERSION) {
  fail(
    `Stale spec: info.version='${spec.info.version}', expected '${EXPECTED_VERSION}'. ` +
    `Bump public/openapi.json (and openapi.yaml) before merging.`
  );
}
if (!spec.info?.title) fail(`info.title missing`);
const pathCount = Object.keys(spec.paths || {}).length;
if (pathCount < 100) fail(`Spec only has ${pathCount} paths; suspicious truncation`);

if (fs.existsSync(CHANGELOG_PATH)) {
  const cl = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf-8'));
  if (cl.apiVersion !== EXPECTED_VERSION) {
    fail(`changelog.json apiVersion='${cl.apiVersion}', expected '${EXPECTED_VERSION}'`);
  }
  const hasEntry = (cl.entries || []).some((e) => e.version === EXPECTED_VERSION);
  if (!hasEntry) fail(`changelog.json missing an entry for v${EXPECTED_VERSION}`);
}

console.log(
  `OK · openapi=${spec.openapi} · version=${spec.info.version} · paths=${pathCount}`
);
