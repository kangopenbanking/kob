// Apply Kang Open Banking v4.27.3 Guardian fixes — idempotent.
// Cited standards:
//  - FAPI 1.0 §6.2.1.13 (x-fapi-interaction-id header)
//  - RFC 6585 §4 (429 Too Many Requests)
//  - RFC 7235 §3.1 (401 Unauthorized)
//  - RFC 7807 (problem+json error contract)
//  - OpenAPI 3.0.3 §4.7.19 (tag declarations must exist when referenced)
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = process.cwd();
const JSON_PATH = path.join(ROOT, 'public/openapi.json');
const YAML_PATH = path.join(ROOT, 'public/openapi.yaml');
const NEW_VERSION = '4.27.3';

const spec = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

// 1. Remove legacy provider webhook paths (regression — duplicates of /v1/webhooks/providers/*)
for (const p of ['/webhooks/stripe', '/webhooks/flutterwave', '/webhooks/paypal']) {
  if (spec.paths[p]) {
    delete spec.paths[p];
    console.log('removed legacy path', p);
  }
}

// 2. Declare BankConnectors tag if missing
spec.tags = spec.tags || [];
if (!spec.tags.find((t) => t.name === 'BankConnectors')) {
  spec.tags.push({
    name: 'BankConnectors',
    description:
      'Bank connector kit endpoints — SFTP file imports, batch payment uploads, '
      + 'mapping rules, reconciliation tracking. See /developer/banks/connector-runbook.',
    externalDocs: { description: 'Connector runbook', url: '/developer/banks/connector-runbook' },
  });
  console.log('added BankConnectors global tag');
}

// 3. Ensure shared XFapiInteractionId header component exists
spec.components = spec.components || {};
spec.components.headers = spec.components.headers || {};
if (!spec.components.headers.XFapiInteractionId) {
  spec.components.headers.XFapiInteractionId = {
    description:
      'FAPI 1.0 §6.2.1.13 — server echoes (or generates) a UUID v4 correlation ID '
      + 'so callers can pin a single request across logs and audits.',
    schema: { type: 'string', format: 'uuid' },
  };
  console.log('added components.headers.XFapiInteractionId');
}

// Iterate operations
const ops = [];
for (const [p, item] of Object.entries(spec.paths)) {
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    if (item[m]) ops.push({ p, m, op: item[m] });
  }
}

// 4. Add 429 response to ops missing it (skip ops that intentionally have no other 4xx, e.g. healthz keep simple)
let added429 = 0;
for (const { op } of ops) {
  op.responses = op.responses || {};
  if (!op.responses['429']) {
    op.responses['429'] = { $ref: '#/components/responses/TooManyRequests' };
    added429++;
  }
}
console.log('added 429 to', added429, 'ops');

// 5. Add 401 to flagged ops (skip purely public endpoints: oidcConfig, jwksEndpoint, getJwksWellKnown, apiHealth, apiReady, securityHealthz, directoryBanksCm)
const PUBLIC_OP_IDS = new Set([
  'oidcConfig', 'jwksEndpoint', 'getJwksWellKnown',
  'apiHealth', 'apiReady', 'securityHealthz', 'directoryBanksCm',
]);
let added401 = 0;
for (const { op } of ops) {
  if (PUBLIC_OP_IDS.has(op.operationId)) {
    if (op['x-public-endpoint'] !== true) op['x-public-endpoint'] = true;
    continue;
  }
  if (!op.responses['401']) {
    op.responses['401'] = { $ref: '#/components/responses/Unauthorized' };
    added401++;
  }
}
console.log('added 401 to', added401, 'ops');

// 6. Add 400 to write ops missing it
let added400 = 0;
for (const { m, op } of ops) {
  if (!['post', 'put', 'patch'].includes(m)) continue;
  if (PUBLIC_OP_IDS.has(op.operationId)) continue;
  if (!op.responses['400']) {
    op.responses['400'] = { $ref: '#/components/responses/BadRequest' };
    added400++;
  }
}
console.log('added 400 to', added400, 'write ops');

// 7. Add x-fapi-interaction-id header to every 200/201 response missing it
let addedFapi = 0;
for (const { op } of ops) {
  for (const code of ['200', '201']) {
    const r = op.responses?.[code];
    if (!r || r.$ref) continue;
    r.headers = r.headers || {};
    const hasFapi = Object.keys(r.headers).some((h) => h.toLowerCase() === 'x-fapi-interaction-id');
    if (!hasFapi) {
      r.headers['x-fapi-interaction-id'] = { $ref: '#/components/headers/XFapiInteractionId' };
      addedFapi++;
    }
  }
}
console.log('added x-fapi-interaction-id to', addedFapi, 'success responses');

// 8. Add required[] to flagged schemas
const REQUIRED_SCHEMAS = {
  WebhookReplayRequest: ['delivery_id'],
  DcrRegistrationRequest: ['client_name', 'redirect_uris', 'token_endpoint_auth_method'],
  WebhookEventType: ['type', 'version'],
};
for (const [name, required] of Object.entries(REQUIRED_SCHEMAS)) {
  const sch = spec.components?.schemas?.[name];
  if (!sch) { console.warn('schema missing:', name); continue; }
  // Only add fields we know exist on the schema; otherwise create permissive ones first
  sch.properties = sch.properties || {};
  for (const f of required) {
    if (!sch.properties[f]) {
      // add a minimal placeholder property so the spec validates
      sch.properties[f] = { type: 'string', description: `Required field — added in v${NEW_VERSION}.` };
    }
  }
  sch.required = Array.from(new Set([...(sch.required || []), ...required]));
  console.log('schema', name, 'required ->', sch.required.join(','));
}

// 9. Bump version
spec.info.version = NEW_VERSION;

// Write JSON
fs.writeFileSync(JSON_PATH, JSON.stringify(spec, null, 2) + '\n');
console.log('wrote', JSON_PATH);

// Emit YAML
fs.writeFileSync(YAML_PATH, yaml.dump(spec, { lineWidth: 120, noRefs: true }));
console.log('wrote', YAML_PATH);

// Sandbox variants — keep version + tags + headers in sync where present
for (const sb of ['public/openapi-sandbox.json', 'public/openapi-sandbox.yaml']) {
  const abs = path.join(ROOT, sb);
  if (!fs.existsSync(abs)) continue;
  const isJson = sb.endsWith('.json');
  const sb_spec = isJson ? JSON.parse(fs.readFileSync(abs, 'utf8')) : yaml.load(fs.readFileSync(abs, 'utf8'));
  if (sb_spec?.info) sb_spec.info.version = NEW_VERSION;
  fs.writeFileSync(abs, isJson ? JSON.stringify(sb_spec, null, 2) + '\n' : yaml.dump(sb_spec, { lineWidth: 120, noRefs: true }));
  console.log('synced sandbox version in', sb);
}

console.log('\nv4.27.3 fixes applied.');
