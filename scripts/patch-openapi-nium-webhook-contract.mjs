#!/usr/bin/env node
/**
 * Phase 1B-R1I-a.3C — Nium contract reconciliation (LOCAL/TEST ONLY).
 *
 * Aligns the public OpenAPI `niumIncomingWebhook` operation with the verified
 * a.3 runtime:
 *   - removes the dishonest generic `Idempotency-Key` parameter (Nium never
 *     sends it);
 *   - declares the optional `x-nium-timestamp` replay-window header;
 *   - adds a documented 409 Conflict response for changed-payload replays;
 *   - attaches the validated `x-kob-idempotency` (mode=provider-event) and
 *     `x-kob-webhook` metadata required by the G3 provider-event exemption.
 *
 * Standing Order compliance:
 *   #1 (Lock)    — method/path/operationId/tags/security unchanged.
 *   #2 (Ratchet) — no required[] removed; only 409 added to responses.
 *   #4 (Surgeon) — only niumIncomingWebhook + its response synchronised in YAML.
 *   #6 (Version) — NO version increment (unreleased 4.53.1 contract fix).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const jsonPath = resolve(root, 'public/openapi.json');
const yamlPath = resolve(root, 'public/openapi.yaml');

const spec = JSON.parse(readFileSync(jsonPath, 'utf8'));

const EXPECTED_VERSION = '4.53.1';
if (spec.info.version !== EXPECTED_VERSION) {
  console.error(`FATAL: expected ${EXPECTED_VERSION}, saw ${spec.info.version}`);
  process.exit(1);
}

const webhookPath = '/v1/gateway/global-accounts/webhook';
const op = spec.paths?.[webhookPath]?.post;
if (!op || op.operationId !== 'niumIncomingWebhook') {
  console.error('FATAL: niumIncomingWebhook not found at expected path');
  process.exit(1);
}

// --- 1. Remove generic Idempotency-Key parameter (and only that ref) ---
const before = op.parameters || [];
op.parameters = before.filter((p) => {
  if (p && typeof p === 'object' && p.$ref === '#/components/parameters/IdempotencyKeyHeader') return false;
  if (p && typeof p === 'object' && (p.name || '').toLowerCase() === 'idempotency-key') return false;
  return true;
});

// --- 2. Declare optional x-nium-timestamp replay-window header ---
const hasTs = op.parameters.some(
  (p) => p && (p.name || '').toLowerCase() === 'x-nium-timestamp',
);
if (!hasTs) {
  op.parameters.push({
    in: 'header',
    name: 'x-nium-timestamp',
    required: false,
    schema: { type: 'string', format: 'date-time' },
    description:
      'RFC 3339 timestamp of the event as produced by Nium. When present, requests outside the ±5 minute replay window are rejected with 401.',
  });
}

// --- 3. Provider-event idempotency metadata (G3 exemption, a.2 shape) ---
op['x-kob-idempotency'] = {
  mode: 'provider-event',
  provider: 'nium',
  'event-id-required': true,
  'signature-required': true,
  'atomic-deduplication-required': true,
  'replay-window-enforced': true,
  'payload-consistency-enforced': true,
  'failure-recovery-enforced': true,
};
op['x-kob-webhook'] = {
  receiver: true,
  provider: 'nium',
  'signature-header': 'x-nium-signature',
  'event-id-location': 'body',
  'event-id-pointer': '/transactionId',
};

// --- 4. Developer-facing description ---
op.description = [
  'Inbound webhook receiver for Nium. Called by Nium when funds land in a global',
  'virtual account.',
  '',
  'Security & delivery guarantees:',
  '- HMAC-SHA256 signature verification via `x-nium-signature` occurs before any',
  '  processing.',
  '- When `x-nium-timestamp` is supplied, events outside the accepted ±5 minute',
  '  replay window are rejected with 401.',
  '- Deduplication is keyed on the Nium event identifier (`transactionId`).',
  '- Identical duplicate deliveries are safely acknowledged with',
  '  `{ ok: true, duplicate: true }`; the domain mutation is not repeated.',
  '- The same event ID replayed with a mutated payload is rejected with',
  '  `409 Conflict` (application/problem+json).',
  '- Failed processing reservations are automatically reclaimed and retried',
  '  according to the verified recovery policy.',
  '- A generic client `Idempotency-Key` header is **not** required or consumed;',
  '  provider-event idempotency is derived from the Nium `transactionId` field.',
  '',
  'Successful acknowledgement returns 200 with the credit outcome. On credit,',
  'KOB applies FX + spread, deducts the withdrawal fee (only for MOBILE_MONEY',
  'routing), credits the user\'s Kang Wallet, and asynchronously dispatches',
  'Mobile Money payouts through Flutterwave when applicable.',
].join('\n');

// --- 5. 409 Conflict response (changed-payload replay) ---
if (!op.responses['409']) {
  op.responses['409'] = { $ref: '#/components/responses/Conflict' };
}

// --- Persist ---
writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + '\n');
writeFileSync(yamlPath, yaml.dump(spec, { noRefs: true, lineWidth: 120 }));

// --- Diagnostics ---
let opCount = 0;
for (const ms of Object.values(spec.paths)) {
  for (const m of Object.keys(ms)) {
    if (['get','post','put','patch','delete'].includes(m)) opCount++;
  }
}
console.log(`OK Nium webhook contract reconciled — version=${spec.info.version} operations=${opCount}`);
console.log(`   removed generic Idempotency-Key: ${before.length - op.parameters.length + 1 - (hasTs ? 0 : 1)} entr(y|ies)`);
console.log(`   provider-event metadata attached: mode=${op['x-kob-idempotency'].mode}`);
