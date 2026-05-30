#!/usr/bin/env node
/**
 * build-signing-key-updates.mjs
 *
 * Emits public/signing-key-updates.json — a tiny, cache-friendly endpoint
 * integrators can POLL on a schedule to detect upcoming/active rotations
 * without parsing the full /artifacts.json payload.
 *
 * Shape:
 *   {
 *     "algorithm": "ed25519",
 *     "generatedAt": "<iso>",
 *     "current": { "fingerprint": "SHA256:…", "fingerprintHex": "06:bd:…",
 *                  "publicKeyUrl": "/artifact-signing-pubkey.pem",
 *                  "establishedAt": "<iso>" },
 *     "next":    null | { "fingerprint": "SHA256:…", "publicKeyUrl": "…",
 *                          "stagedAt": "<iso>", "status": "staged" },
 *     "history": [ { "fingerprint": "SHA256:…", "establishedAt": "…",
 *                    "retiredAt": "<iso>" }, … ],
 *     "docsUrl": "/docs/signing-key-rotation.md",
 *     "rotationProcedureUrl": "/developer/openapi#rotation",
 *     "pollIntervalSeconds": 21600
 *   }
 *
 * History is preserved across builds: every time the current fingerprint
 * changes, the previous one is appended with its retiredAt timestamp.
 */
import fs from 'node:fs';

const OUT = 'public/signing-key-updates.json';
const src = JSON.parse(fs.readFileSync('public/downloads-checksums.json', 'utf8'));
const sig = src.signing || {};

const now = new Date().toISOString();
let prev = null;
if (fs.existsSync(OUT)) {
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { prev = null; }
}

const currentFp = sig.publicKeyFingerprint;
const prevCurrent = prev?.current?.fingerprint;
const history = Array.isArray(prev?.history) ? [...prev.history] : [];

// Rotation detected: the previously-current key just got retired.
if (prevCurrent && currentFp && prevCurrent !== currentFp) {
  history.push({
    fingerprint: prevCurrent,
    fingerprintHex: prev?.current?.fingerprintHex,
    establishedAt: prev?.current?.establishedAt,
    retiredAt: now,
  });
}

const out = {
  algorithm: sig.algorithm || 'ed25519',
  generatedAt: now,
  current: currentFp ? {
    fingerprint: currentFp,
    fingerprintHex: sig.publicKeyFingerprintSha256Hex,
    publicKeyUrl: sig.publicKeyUrl || '/artifact-signing-pubkey.pem',
    establishedAt: prevCurrent === currentFp
      ? (prev?.current?.establishedAt || now)
      : now,
  } : null,
  next: sig.next ? {
    fingerprint: sig.next.publicKeyFingerprint,
    fingerprintHex: sig.next.publicKeyFingerprintSha256Hex,
    publicKeyUrl: sig.next.publicKeyUrl,
    status: sig.next.status || 'staged',
    stagedAt: prev?.next?.fingerprint === sig.next.publicKeyFingerprint
      ? (prev?.next?.stagedAt || now)
      : now,
    note: sig.next.note,
  } : null,
  history,
  docsUrl: '/docs/signing-key-rotation.md',
  rotationProcedureUrl: '/developer/openapi#rotation',
  changelogUrl: '/developer/changelog#signing-keys',
  pollIntervalSeconds: 21600, // 6 hours
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${OUT} (current=${out.current?.fingerprint || 'n/a'}, ` +
    `next=${out.next?.fingerprint || 'none'}, history=${out.history.length})`
);
