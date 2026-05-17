#!/usr/bin/env node
/**
 * Phase 2 — AuthZ scope matrix + webhook resilience (additive, SO-1/4/6)
 *
 * - Bumps info.version 4.33.0 → 4.34.0 in production + sandbox specs.
 * - Adds `apiKeyScopes` documentation extension (x-scopes) onto bearerAuth so
 *   tooling can render the scope matrix. Existing security requirements stay.
 * - Adds reusable headers:
 *     X-Webhook-Replay         (boolean, true on manual replays)
 *     X-Webhook-Replay-Of      (UUID of the original delivery being replayed)
 *     X-Circuit-State          (closed|half_open|open) on 5xx receiver errors
 * - Surfaces those headers in the top-level OpenAPI 3.1 `webhooks` block,
 *   without renaming any existing event or path.
 * - Mirrors the production spec into the sandbox spec.
 *
 * Strict additive: no operationId / path / schema / securityScheme rename.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = process.cwd();
const SPEC_JSON = path.join(ROOT, 'public/openapi.json');
const SPEC_YAML = path.join(ROOT, 'public/openapi.yaml');
const SANDBOX_JSON = path.join(ROOT, 'public/openapi-sandbox.json');
const SANDBOX_YAML = path.join(ROOT, 'public/openapi-sandbox.yaml');
const NEW_VERSION = '4.34.0';

const REPLAY_HEADER = {
  description: 'Set to `true` when the event is a manual replay from the DLQ or operator console.',
  schema: { type: 'boolean' },
};
const REPLAY_OF_HEADER = {
  description: 'UUID of the original delivery being replayed. Only present when `X-Webhook-Replay: true`.',
  schema: { type: 'string', format: 'uuid' },
};
const CIRCUIT_HEADER = {
  description: 'Current circuit-breaker state for the receiving endpoint (`closed`, `half_open`, `open`). Echoed on every webhook attempt so receivers can self-throttle.',
  schema: { type: 'string', enum: ['closed', 'half_open', 'open'] },
};

const SCOPE_MATRIX = {
  description: 'Per-key scope matrix enforced by the gateway. Keys MUST carry at least one scope from this list.',
  scopes: {
    'charges:read':       'Read charges, refunds, captures',
    'charges:write':      'Create, capture, refund, reverse, or void charges',
    'payouts:read':       'Read payouts, settlements, beneficiaries',
    'payouts:write':      'Create or cancel payouts and beneficiaries',
    'customers:read':     'Read customers, tokens, payment methods',
    'customers:write':    'Create, update, or delete customers and tokens',
    'webhooks:manage':    'Create, update, rotate, or delete webhook endpoints',
    'webhooks:replay':    'Replay deliveries from the dead-letter queue',
    'reports:read':       'Read settlements, exports, audit logs, reconciliation reports',
    'compliance:read':    'Read KYC/KYB, AML screening, dispute evidence',
    'compliance:write':   'Submit KYC/KYB documents, dispute evidence, SAR filings',
    'admin:*':            'Full administrative access (admin keys only)',
  },
};

function bumpSpec(spec) {
  spec.info = spec.info || {};
  spec.info.version = NEW_VERSION;

  spec.components ??= {};
  spec.components.headers ??= {};
  spec.components.headers['X-Webhook-Replay'] = REPLAY_HEADER;
  spec.components.headers['X-Webhook-Replay-Of'] = REPLAY_OF_HEADER;
  spec.components.headers['X-Circuit-State'] = CIRCUIT_HEADER;

  // Attach scope matrix to bearerAuth as a non-breaking documentation extension.
  spec.components.securitySchemes ??= {};
  if (spec.components.securitySchemes.bearerAuth) {
    spec.components.securitySchemes.bearerAuth['x-scopes'] = SCOPE_MATRIX;
  }

  // Add the new headers into every documented webhook so receivers see them in tooling.
  if (spec.webhooks) {
    for (const [_eventName, pathItem] of Object.entries(spec.webhooks)) {
      const post = pathItem?.post;
      if (!post) continue;
      post.parameters ??= [];
      const has = (name) => post.parameters.some(
        (p) => (p?.name === name && p?.in === 'header') ||
               (p?.$ref && p.$ref.endsWith(`/${name}`))
      );
      if (!has('X-Webhook-Replay')) {
        post.parameters.push({
          in: 'header', name: 'X-Webhook-Replay', required: false,
          schema: { type: 'boolean' },
          description: 'true when this delivery is a manual replay from the DLQ.',
        });
      }
      if (!has('X-Webhook-Replay-Of')) {
        post.parameters.push({
          in: 'header', name: 'X-Webhook-Replay-Of', required: false,
          schema: { type: 'string', format: 'uuid' },
          description: 'UUID of the original delivery (only present when X-Webhook-Replay is true).',
        });
      }
      if (!has('X-Circuit-State')) {
        post.parameters.push({
          in: 'header', name: 'X-Circuit-State', required: false,
          schema: { type: 'string', enum: ['closed', 'half_open', 'open'] },
          description: 'Current circuit-breaker state for this endpoint at delivery time.',
        });
      }
    }
  }

  return spec;
}

function processFile(jsonPath, yamlPath) {
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const spec = JSON.parse(raw);
  bumpSpec(spec);
  fs.writeFileSync(jsonPath, JSON.stringify(spec, null, 2));
  fs.writeFileSync(yamlPath, YAML.stringify(spec));
  console.log(`✓ ${path.relative(ROOT, jsonPath)} -> ${NEW_VERSION}`);
}

processFile(SPEC_JSON, SPEC_YAML);
processFile(SANDBOX_JSON, SANDBOX_YAML);

// Snapshot the new spec into openapi-history.
const snapshotPath = path.join(ROOT, 'public/openapi-history', `openapi-${NEW_VERSION}.json`);
fs.copyFileSync(SPEC_JSON, snapshotPath);
console.log(`✓ snapshot written: ${path.relative(ROOT, snapshotPath)}`);

// Update history manifest.
const manifestPath = path.join(ROOT, 'public/openapi-history/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
manifest.current = NEW_VERSION;
if (!manifest.versions.some((v) => v.version === NEW_VERSION)) {
  manifest.versions.unshift({
    version: NEW_VERSION,
    released_at: new Date().toISOString(),
    type: 'snapshot',
    file: `openapi-${NEW_VERSION}.json`,
    notes: 'Phase 2 — AuthZ scope matrix on bearerAuth, webhook circuit-breaker headers, X-Webhook-Replay header, webhook event registry page.',
  });
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ manifest updated');

console.log(`\nPhase 2 spec hardening complete — info.version=${NEW_VERSION}`);
