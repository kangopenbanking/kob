#!/usr/bin/env node
/**
 * Phase 3 — Reconciliation closeout (additive, SO-1/4/6)
 *
 * - Bumps info.version 4.34.0 → 4.35.0.
 * - Adds top-level `x-state-machine` extension to OpenAPI documenting the
 *   canonical charge state machine (states + transitions). Pure documentation,
 *   no rename, no required-field change.
 * - Adds `x-audit-export-bucket: audit-exports` extension so SDK/tooling can
 *   discover the immutable export destination.
 * - Mirrors production -> sandbox spec, snapshots history, updates manifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = process.cwd();
const SPEC_JSON = path.join(ROOT, 'public/openapi.json');
const SPEC_YAML = path.join(ROOT, 'public/openapi.yaml');
const SANDBOX_JSON = path.join(ROOT, 'public/openapi-sandbox.json');
const SANDBOX_YAML = path.join(ROOT, 'public/openapi-sandbox.yaml');
const NEW_VERSION = '4.35.0';

const STATE_MACHINE = {
  name: 'charge',
  description: 'Canonical lifecycle for every gateway charge. The /developer/payments/state-machine page is the human-readable mirror.',
  states: [
    { name: 'created',    terminal: false },
    { name: 'processing', terminal: false },
    { name: 'pending',    terminal: false },
    { name: 'authorized', terminal: false },
    { name: 'disputed',   terminal: false },
    { name: 'succeeded',  terminal: true },
    { name: 'captured',   terminal: true },
    { name: 'failed',     terminal: true },
    { name: 'cancelled',  terminal: true },
    { name: 'voided',     terminal: true },
    { name: 'expired',    terminal: true },
    { name: 'refunded',   terminal: true },
    { name: 'reversed',   terminal: true },
  ],
  transitions: [
    ['created', 'processing'], ['created', 'failed'], ['created', 'cancelled'],
    ['processing', 'pending'], ['processing', 'authorized'], ['processing', 'succeeded'], ['processing', 'failed'],
    ['pending', 'succeeded'], ['pending', 'failed'], ['pending', 'expired'],
    ['authorized', 'captured'], ['authorized', 'voided'], ['authorized', 'expired'],
    ['succeeded', 'refunded'], ['captured', 'refunded'],
    ['succeeded', 'reversed'], ['succeeded', 'disputed'],
    ['disputed', 'reversed'], ['disputed', 'succeeded'],
  ],
};

function bumpSpec(spec) {
  spec.info = spec.info || {};
  spec.info.version = NEW_VERSION;
  spec['x-state-machine'] = STATE_MACHINE;
  spec['x-audit-export-bucket'] = {
    name: 'audit-exports',
    description: 'Immutable, admin-only storage bucket for regulatory audit exports. Write-once via service role; read via short-lived signed URLs.',
    immutable: true,
    retention_days: 2557, // 7 years (COBAC)
  };
  return spec;
}

function processFile(jsonPath, yamlPath) {
  const spec = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  bumpSpec(spec);
  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2));
  fs.writeFileSync(yamlPath, YAML.stringify(spec));
  console.log(`✓ ${path.relative(ROOT, jsonPath)} -> ${NEW_VERSION}`);
}

processFile(SPEC_JSON, SPEC_YAML);
processFile(SANDBOX_JSON, SANDBOX_YAML);

const snapshotPath = path.join(ROOT, 'public/openapi-history', `openapi-${NEW_VERSION}.json`);
fs.copyFileSync(SPEC_JSON, snapshotPath);
console.log(`✓ snapshot: ${path.relative(ROOT, snapshotPath)}`);

const manifestPath = path.join(ROOT, 'public/openapi-history/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
manifest.current = NEW_VERSION;
if (!manifest.versions.some((v) => v.version === NEW_VERSION)) {
  manifest.versions.unshift({
    version: NEW_VERSION,
    released_at: new Date().toISOString(),
    type: 'snapshot',
    file: `openapi-${NEW_VERSION}.json`,
    notes: 'Phase 3 — Reconciliation closeout. Canonical x-state-machine, audit-exports bucket, reconciliation_mismatches Kanban columns.',
  });
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ manifest updated');
console.log(`\nPhase 3 spec hardening complete — info.version=${NEW_VERSION}`);
