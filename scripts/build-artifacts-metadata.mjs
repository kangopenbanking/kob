#!/usr/bin/env node
/**
 * build-artifacts-metadata.mjs
 *
 * Emits public/artifacts.json — the canonical, public, machine-readable index
 * of every downloadable artifact, including:
 *   - SHA-256 + Ed25519 signature filenames for every artifact
 *   - Current signing key fingerprint (SHA256:<base64> of SPKI DER) + algorithm
 *   - Staged "next" key (if configured) for rotation pre-pinning
 *   - Verification + rotation instructions URLs
 *
 * Read-only consumer of public/downloads-checksums.json.
 */
import fs from 'node:fs';

const src = JSON.parse(fs.readFileSync('public/downloads-checksums.json', 'utf8'));

const out = {
  ssot: src.ssot,
  generatedAt: src.generatedAt,
  algorithm: src.algorithm,
  signing: {
    ...src.signing,
    verifyInstructionsUrl: src.signing?.verifyInstructionsUrl || '/developer/openapi#verify',
    rotationDocsUrl: src.signing?.rotationDocsUrl || '/developer/openapi#rotation',
  },
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
console.log(
  `Wrote public/artifacts.json (${out.artifacts.length} artifacts, ` +
    `fingerprint=${out.signing?.publicKeyFingerprint || 'n/a'}` +
    `${out.signing?.next ? `, next=${out.signing.next.publicKeyFingerprint}` : ''}).`
);
