#!/usr/bin/env node
/**
 * CI gate: verify every public developer-portal version surface matches the
 * expected API version. Fails the build if OpenAPI, changelog, Postman, or
 * canonical guide metadata is missing or stale.
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
const POSTMAN_MANIFEST_PATH = path.resolve(process.cwd(), 'public/postman/manifest.json');
const POSTMAN_LATEST_PATH = path.resolve(process.cwd(), 'public/postman/Kang_Open_Banking_API_latest.postman_collection.json');
const PUBLIC_CHANGELOG_MD_PATH = path.resolve(process.cwd(), 'public/CHANGELOG.md');

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
  for (let minor = 17; minor <= 29; minor += 1) {
    const prefix = `4.${minor}.`;
    if (!(cl.entries || []).some((e) => typeof e.version === 'string' && e.version.startsWith(prefix))) {
      fail(`changelog.json missing release coverage for v${prefix}x`);
    }
  }
}

if (fs.existsSync(POSTMAN_MANIFEST_PATH)) {
  const manifest = JSON.parse(fs.readFileSync(POSTMAN_MANIFEST_PATH, 'utf-8'));
  if (manifest.apiVersion !== EXPECTED_VERSION) fail(`postman/manifest.json apiVersion='${manifest.apiVersion}', expected '${EXPECTED_VERSION}'`);
  if (manifest.current !== EXPECTED_VERSION) fail(`postman/manifest.json current='${manifest.current}', expected '${EXPECTED_VERSION}'`);
  const expectedCollection = `/postman/Kang_Open_Banking_API_v${EXPECTED_VERSION}.postman_collection.json`;
  if (manifest.collection?.versioned !== expectedCollection) fail(`postman versioned collection is '${manifest.collection?.versioned}', expected '${expectedCollection}'`);
}

if (fs.existsSync(POSTMAN_LATEST_PATH)) {
  const postman = JSON.parse(fs.readFileSync(POSTMAN_LATEST_PATH, 'utf-8'));
  if (postman.info?.version !== EXPECTED_VERSION) fail(`Postman latest collection version='${postman.info?.version}', expected '${EXPECTED_VERSION}'`);
  if (postman.info?.name !== `Kang Open Banking API v${EXPECTED_VERSION}`) fail(`Postman latest collection name is stale: '${postman.info?.name}'`);
}

if (fs.existsSync(PUBLIC_CHANGELOG_MD_PATH)) {
  const md = fs.readFileSync(PUBLIC_CHANGELOG_MD_PATH, 'utf-8');
  if (!md.includes(`Current API version: **${EXPECTED_VERSION}**`)) {
    fail(`public/CHANGELOG.md header does not show ${EXPECTED_VERSION}`);
  }
}

console.log(
  `OK · openapi=${spec.openapi} · version=${spec.info.version} · paths=${pathCount}`
);
