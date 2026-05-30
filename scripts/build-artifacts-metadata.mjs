#!/usr/bin/env node
/**
 * build-artifacts-metadata.mjs
 *
 * Emits public/artifacts.json — the canonical, public, machine-readable index
 * of every downloadable artifact:
 *
 *   {
 *     "ssot": { "apiVersion": "...", "sdkVersions": {...} },
 *     "generatedAt": "...",
 *     "signing":   { "algorithm": "ed25519", "publicKeyUrl": "/artifact-signing-pubkey.pem", ... },
 *     "releaseNotesUrl": "/sdk-downloads/SDK_RELEASE_NOTES.md",
 *     "sdkChangelogs": { "node": "/sdk-downloads/CHANGELOG-node.md", ... },
 *     "artifacts": [
 *       { "url": "/openapi.json", "category": "openapi", "version": "4.49.0",
 *         "size": 12345, "sha256": "...", "signature": { "algorithm": "ed25519",
 *         "sigUrl": "/openapi.json.sig" } },
 *       ...
 *     ]
 *   }
 *
 * Read-only consumer of public/downloads-checksums.json; everything else on
 * this file is metadata that integrators can poll on a schedule.
 */
import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync('public/downloads-checksums.json', 'utf8'));

const out = {
  ssot: src.ssot,
  generatedAt: src.generatedAt,
  algorithm: src.algorithm,
  signing: src.signing,
  verifyHint: src.verifyHint,
  releaseNotesUrl: '/sdk-downloads/SDK_RELEASE_NOTES.md',
  sdkChangelogs: {
    node: '/sdk-downloads/CHANGELOG-node.md',
    php: '/sdk-downloads/CHANGELOG-php.md',
    python: '/sdk-downloads/CHANGELOG-python.md',
  },
  cli: {
    npx: 'curl -sSL https://kangopenbanking.com/scripts/kob-fetch.mjs | node - all',
    targets: ['openapi', 'openapi-sandbox', 'postman', 'sdk-node', 'sdk-php', 'sdk-python', 'all'],
  },
  artifacts: src.artifacts,
};

fs.writeFileSync('public/artifacts.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote public/artifacts.json (${out.artifacts.length} artifacts).`);
