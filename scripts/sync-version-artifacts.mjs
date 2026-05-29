#!/usr/bin/env node
/**
 * sync-version-artifacts.mjs
 *
 * Single command that propagates the SSOT version (src/config/version.ts)
 * to every public artifact:
 *   - public/openapi.json    info.version
 *   - public/openapi.yaml    regenerated from JSON
 *   - public/openapi-sandbox.json/.yaml info.version (if present)
 *   - public/changelog.json  apiVersion + lastUpdated (entry must already exist
 *                            for the new version, else fail loudly under P7)
 *   - public/CHANGELOG.md    regenerated
 *   - public/postman/Kang_Open_Banking_API_v<X>.postman_collection.json
 *   - public/postman/Kang_Open_Banking_API_latest.postman_collection.json
 *   - public/postman/manifest.json
 *
 * Idempotent. Safe to run on every CI build, every commit hook, and as the
 * last step of `npm run predeploy`.
 *
 * Justification: Standing Order 6 (Version Gate) + ORDER P7 (Changelog Rule)
 * + ORDER P10 (Living Docs Rule).
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { readExpectedVersion } from './lib/read-expected-version.mjs';

const ROOT = process.cwd();
const VERSION = readExpectedVersion();
const TODAY = new Date().toISOString().slice(0, 10);

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

let mutated = 0;

// 1. OpenAPI JSON + YAML (production + sandbox)
for (const baseName of ['openapi', 'openapi-sandbox']) {
  const jsonPath = path.join(ROOT, `public/${baseName}.json`);
  if (!fs.existsSync(jsonPath)) continue;
  const spec = readJson(jsonPath);
  if (spec.info?.version !== VERSION) {
    spec.info.version = VERSION;
    writeJson(jsonPath, spec);
    mutated++;
    console.log(`  • ${baseName}.json info.version → ${VERSION}`);
  }
  // Regenerate YAML from JSON (always — keeps them byte-canonical)
  const yamlPath = path.join(ROOT, `public/${baseName}.yaml`);
  fs.writeFileSync(yamlPath, yaml.dump(spec, { lineWidth: 120, noRefs: true }));
  console.log(`  • ${baseName}.yaml regenerated`);
}

// 2. changelog.json — must already have an entry for VERSION (humans write the
// substance; this script only updates the apiVersion + lastUpdated header).
const changelogPath = path.join(ROOT, 'public/changelog.json');
const cl = readJson(changelogPath);
const hasEntry = (cl.entries || []).some((e) => e.version === VERSION);
if (!hasEntry) {
  console.error(
    `\n::error::changelog.json has no entry for v${VERSION}.\n` +
    `Add one (summary + highlights + standard_citations) before bumping ` +
    `src/config/version.ts. ORDER P7 forbids version bumps without changelog.`
  );
  process.exit(1);
}
if (cl.apiVersion !== VERSION || cl.lastUpdated !== TODAY) {
  cl.apiVersion = VERSION;
  cl.lastUpdated = TODAY;
  writeJson(changelogPath, cl);
  mutated++;
  console.log(`  • changelog.json header → v${VERSION} (${TODAY})`);
}

// 3. Regenerate CHANGELOG.md + index (always — cheap and idempotent)
await import('./build-changelog-index.mjs');
await import('./build-changelog-md.mjs');

// 3b. Snapshot the OpenAPI build into openapi-history/ + register manifest entry
await import('./snapshot-openapi-history.mjs');
// 3c. Mirror every JSON snapshot to YAML for per-version downloads (Phase 11).
await import('./snapshot-openapi-yaml-history.mjs');

// 4. Postman manifest + versioned + latest collection
const manifestPath = path.join(ROOT, 'public/postman/manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = readJson(manifestPath);
  const versionedFile = `Kang_Open_Banking_API_v${VERSION}.postman_collection.json`;
  const versionedPath = path.join(ROOT, `public/postman/${versionedFile}`);
  // If the versioned collection doesn't exist yet, clone the previous current.
  if (!fs.existsSync(versionedPath)) {
    const prev = path.join(ROOT, 'public/postman', `Kang_Open_Banking_API_v${manifest.current}.postman_collection.json`);
    if (fs.existsSync(prev)) {
      fs.copyFileSync(prev, versionedPath);
      console.log(`  • Postman: cloned v${manifest.current} → v${VERSION}`);
    }
  }
  for (const f of [
    versionedPath,
    path.join(ROOT, 'public/postman/Kang_Open_Banking_API_latest.postman_collection.json'),
  ]) {
    if (!fs.existsSync(f)) continue;
    const c = readJson(f);
    if (c.info?.version !== VERSION) {
      c.info.version = VERSION;
      c.info.name = `Kang Open Banking API v${VERSION}`;
      writeJson(f, c);
      mutated++;
      console.log(`  • ${path.basename(f)} → v${VERSION}`);
    }
  }
  if (manifest.apiVersion !== VERSION || manifest.current !== VERSION) {
    manifest.apiVersion = VERSION;
    manifest.current = VERSION;
    manifest.generatedAt = new Date().toISOString();
    manifest.collection.versioned = `/postman/${versionedFile}`;
    if (!manifest.versions.some((v) => v.version === VERSION)) {
      manifest.versions.unshift({
        version: VERSION,
        file: versionedFile,
        released_at: manifest.generatedAt,
      });
    }
    writeJson(manifestPath, manifest);
    mutated++;
    console.log(`  • postman/manifest.json → v${VERSION}`);
  }
}

console.log(
  `\nsync-version-artifacts: target=v${VERSION} · ${mutated ? `${mutated} file(s) updated` : 'all artifacts already in sync'}.`
);
