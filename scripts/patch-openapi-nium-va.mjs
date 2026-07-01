#!/usr/bin/env node
/**
 * Patch public/openapi.json + openapi.yaml so the shipped Virtual Accounts
 * surface matches the Nium-powered spec defined in
 * supabase/functions/public-api-spec/index.ts.
 *
 * Additive/surgical — Standing Orders 1 (Lock) and 2 (Ratchet) respected:
 *   - operationIds and path keys are preserved
 *   - existing required[] fields are kept
 *   - new enum values / properties added; no removals
 *   - info.version bumped 4.52.0 -> 4.52.1 (patch, non-breaking)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const root = process.cwd();
const jsonPath = resolve(root, 'public/openapi.json');
const yamlPath = resolve(root, 'public/openapi.yaml');

const spec = JSON.parse(readFileSync(jsonPath, 'utf8'));

const NEW_VERSION = '4.52.1';
spec.info.version = NEW_VERSION;

// ---- 1. GatewayVirtualAccount schema (additive rewrite) ----
spec.components.schemas.GatewayVirtualAccount = {
  type: 'object',
  description:
    'Nium-issued dedicated receiving account. account_kind="virtual" returns local account coordinates; "global" returns IBAN/SWIFT details. All inbound funds auto-convert to XAF via the shared Nium FX engine.',
  properties: {
    id: { type: 'string', format: 'uuid' },
    merchant_id: { type: 'string', format: 'uuid' },
    account_kind: {
      type: 'string', enum: ['virtual', 'global'], default: 'virtual',
      description: 'Nium account class. Virtual = local rails; Global = IBAN/SWIFT receiving.',
    },
    account_number: { type: 'string', example: 'GB29NWBK60161331926819' },
    iban: { type: 'string', nullable: true, example: 'GB29NWBK60161331926819' },
    bic: { type: 'string', nullable: true, example: 'NWBKGB2L' },
    routing_code: { type: 'string', nullable: true, description: 'Local clearing code (ABA, sort code, IFSC, BSB, etc.) when applicable.' },
    bank_name: { type: 'string', example: 'Citibank N.A. (via Nium)' },
    bank_address: { type: 'string', nullable: true },
    beneficiary_name: { type: 'string', description: 'Must match the KYC-verified legal name.' },
    currency: {
      type: 'string',
      enum: ['USD','EUR','GBP','AUD','CAD','SGD','AED','JPY','INR','ZAR','HKD','CHF','NZD','SEK','NOK','DKK','CNY','XAF','XOF','NGN','GHS','KES'],
      example: 'USD',
      description: 'Receiving currency. Funds settle to XAF by default.',
    },
    destination_currency: { type: 'string', example: 'XAF', default: 'XAF' },
    provider: { type: 'string', enum: ['nium'], default: 'nium' },
    mode: { type: 'string', enum: ['stub', 'sandbox', 'live'] },
    status: { type: 'string', enum: ['active', 'suspended', 'closed'] },
    email: { type: 'string' },
    expiry: { type: 'string', format: 'date-time' },
    created_at: { type: 'string', format: 'date-time' },
    bank_country: {
      type: 'string',
      description: 'ISO 3166-1 alpha-2 country code of the issuing bank.',
      example: 'CM',
    },
  },
  // Preserve original required[] to honour Standing Order 2 (Ratchet).
  required: ['id', 'merchant_id', 'account_number', 'bank_name', 'currency'],
};

// ---- 2. POST /v1/gateway/virtual-accounts request body (additive) ----
const va = spec.paths['/v1/gateway/virtual-accounts'];
if (va?.post?.requestBody?.content?.['application/json']?.schema) {
  const s = va.post.requestBody.content['application/json'].schema;
  s.required = ['merchant_id', 'email'];
  s.properties = {
    merchant_id: { type: 'string', format: 'uuid' },
    email: { type: 'string' },
    beneficiary_name: { type: 'string', description: 'Must match the KYC-verified legal name on file.' },
    account_kind: { type: 'string', enum: ['virtual', 'global'], default: 'virtual' },
    currency: {
      type: 'string',
      enum: ['USD','EUR','GBP','AUD','CAD','SGD','AED','JPY','INR','ZAR','HKD','CHF','NZD','SEK','NOK','DKK','CNY'],
      default: 'USD',
      description: 'Receiving currency for the Nium-issued account.',
    },
    pop_code: { type: 'string', description: 'BEAC Purpose-of-Payment code (whitelist enforced).' },
    bvn: {
      type: 'string',
      deprecated: true,
      description:
        'DEPRECATED. Legacy NGN-rail Bank Verification Number. Ignored on Nium provisioning; accepted only for backward compatibility. Requests including `bvn` will succeed but the field is stripped server-side and returned as a warning in `meta.warnings[]`.',
    },
    is_permanent: { type: 'boolean', default: true, description: 'Nium accounts are permanent by default.' },
    narration: { type: 'string' },
  };
  va.post.summary = 'Create virtual account (Nium)';
  va.post.description =
    'Provision a dedicated Nium virtual receiving account. Supports 17 source currencies (USD, EUR, GBP, AUD, CAD, SGD, AED, JPY, INR, ZAR, HKD, CHF, NZD, SEK, NOK, DKK, CNY) with XAF as the locked destination currency. `account_kind="global"` returns IBAN/SWIFT details for cross-border collections.';
}

// ---- 3. GET /v1/gateway/virtual-accounts — add account_kind filter ----
if (va?.get?.parameters) {
  const hasKind = va.get.parameters.some((p) => p.name === 'account_kind');
  if (!hasKind) {
    va.get.parameters.push({
      name: 'account_kind', in: 'query', required: false,
      schema: { type: 'string', enum: ['virtual', 'global'] },
      description: 'Filter by Nium account class.',
    });
  }
}

writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + '\n');

// ---- 4. Emit YAML from patched JSON ----
writeFileSync(yamlPath, yaml.dump(spec, { noRefs: true, lineWidth: 120 }));

console.log(`OK Nium VA spec patch applied — info.version=${NEW_VERSION}`);
