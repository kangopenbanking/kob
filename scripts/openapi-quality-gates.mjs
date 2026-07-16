#!/usr/bin/env node
/**
 * OpenAPI Quality Gates — CI ratchets for Phase 5.1.
 *
 * Enforces (in line with Guardian Standing Orders + ORDER P5/P6):
 *  G1 — every 2xx response (except 204) declares a schema
 *  G2 — every webhook receiver path documents signature header + dedupe note
 *  G3 — every financial mutation accepts an Idempotency-Key header
 *  G4 — every list endpoint exposes a pagination contract (cursor OR page+limit)
 *  G5 — every 4xx/5xx response uses application/problem+json (RFC 7807) with ProblemDetails
 *  G6 — every state-mutating operation (POST/PUT/PATCH/DELETE) declares 409 + 429
 *       (RFC 7231 §6.5.8 Conflict, RFC 6585 §4 Too Many Requests)
 *  G7 — every DELETE operation accepts an Idempotency-Key header
 *       (draft-ietf-httpapi-idempotency-key-header §2)
 *  G8 — every paginated list endpoint exposes cursor parity
 *       (starting_after + ending_before alongside any offset/page)
 *  G9 — every operation accepts an optional X-Request-ID correlation header
 *       (W3C Trace Context-style propagation, Phase 1 hardening)
 *
 * Usage:   node scripts/openapi-quality-gates.mjs [--spec public/openapi.json]
 * Exit 0 = all gates pass. Exit 1 = at least one gate failed.
 *
 * Designed to be wired into CI (e.g. GitHub Actions) as a blocking check.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const specIdx = args.indexOf('--spec');
const specPath = specIdx >= 0 ? args[specIdx + 1] : 'public/openapi.json';
// Phase 1A: optional --allowlist <path> for isolated test harness use.
// Default remains scripts/openapi-quality-gates.allow.json (fully backward compatible).
const allowIdx = args.indexOf('--allowlist');
const allowExceptionsPath = allowIdx >= 0 ? args[allowIdx + 1] : 'scripts/openapi-quality-gates.allow.json';

if (!fs.existsSync(specPath)) {
  console.error(`[quality-gates] spec not found: ${specPath}`);
  process.exit(2);
}

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const allow = fs.existsSync(allowExceptionsPath)
  ? JSON.parse(fs.readFileSync(allowExceptionsPath, 'utf8'))
  : { G1: [], G2: [], G3: [], G4: [], G5: [], G6: [], G7: [], G8: [], G9: [] };

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// Operations that mutate funds / state and therefore require Idempotency-Key.
// Heuristic: POST/PUT/PATCH/DELETE on paths whose tag or path segment matches
// any of these financial keywords. GET is never required.
const FINANCIAL_PATH_PATTERNS = [
  /\/v1\/(payments|payouts|transfers|charges|refunds|disputes|funding|settlements|gateway|loans|savings|piggybank|njangi|cards|escrow|remittances|invoices|subscriptions|payment-links|withdrawals|bills|merchants\/api-keys)\b/i,
  /\/v1\/oauth\/(token|introspect|revoke|par|dcr)/i,
];

const WEBHOOK_PATH = /\/webhooks\//i;

const failures = [];
const counters = { G1: 0, G2: 0, G3: 0, G4: 0, G5: 0, G6: 0, G7: 0, G8: 0, G9: 0 };

function fail(gate, opKey, message) {
  if ((allow[gate] || []).includes(opKey)) return;
  failures.push({ gate, opKey, message });
  counters[gate] += 1;
}

function isPaginated(op) {
  const params = op.parameters || [];
  const names = new Set(params.map((p) => (p.$ref ? p.$ref.split('/').pop() : p.name)));
  return (
    names.has('cursor') ||
    names.has('CursorParam') ||
    (names.has('limit') && (names.has('page') || names.has('offset') || names.has('cursor'))) ||
    names.has('PageParam') ||
    names.has('LimitParam')
  );
}

function hasIdempotencyKey(op) {
  for (const p of op.parameters || []) {
    const name = p.$ref ? p.$ref.split('/').pop() : p.name;
    if (typeof name === 'string' && name.toLowerCase() === 'idempotency-key') return true;
    if (name === 'IdempotencyKey' || name === 'IdempotencyKeyHeader') return true;
  }
  return false;
}

// ─── Phase 1B-R1I-a.2 · Provider-event idempotency exemption ────────────────
// Narrowly-scoped G3 exemption for genuine provider webhooks that use
// provider-supplied event IDs + atomic dedupe instead of a generic client
// Idempotency-Key. All controls MUST be explicitly declared — no field
// defaults silently to true. Naming ("webhook" in path/opId/tag/summary/
// description) never qualifies on its own; only explicit structured
// x-kob-webhook + x-kob-idempotency metadata backed by real OpenAPI shape
// (POST, required signature header, resolvable required event-ID) qualifies.
function resolveRef(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null;
  const parts = ref.slice(2).split('/');
  let node = spec;
  for (const p of parts) {
    if (node == null || typeof node !== 'object') return null;
    node = node[p];
  }
  return node ?? null;
}
function resolveParam(p) {
  if (p && p.$ref) return resolveRef(p.$ref);
  return p;
}
function jsonPointerLookup(root, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) return undefined;
  const parts = pointer.slice(1).split('/').map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node = root;
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return undefined;
    if (node.$ref) node = resolveRef(node.$ref);
    if (node && node.properties && Object.prototype.hasOwnProperty.call(node.properties, part)) {
      node = node.properties[part];
      if (node && node.$ref) node = resolveRef(node.$ref);
      continue;
    }
    return undefined;
  }
  return node;
}

const REQUIRED_PROVIDER_EVENT_BOOLEANS = [
  'event-id-required',
  'signature-required',
  'atomic-deduplication-required',
  'replay-window-enforced',
  'payload-consistency-enforced',
  'failure-recovery-enforced',
];

function hasValidProviderEventIdempotency(operation, method, _pathKey, pathItem) {
  const idem = operation['x-kob-idempotency'];
  if (idem === undefined) return { ok: false, present: false };
  if (idem === null || typeof idem !== 'object' || Array.isArray(idem)) {
    return { ok: false, present: true, reason: 'x-kob-idempotency must be an object' };
  }
  if (idem.mode !== 'provider-event') {
    return { ok: false, present: true, reason: `invalid mode "${String(idem.mode)}" (expected "provider-event")` };
  }
  if (typeof idem.provider !== 'string' || idem.provider.length === 0) {
    return { ok: false, present: true, reason: 'provider must be a non-empty string' };
  }
  for (const k of REQUIRED_PROVIDER_EVENT_BOOLEANS) {
    if (!(k in idem)) return { ok: false, present: true, reason: `${k} is required` };
    if (idem[k] !== true) return { ok: false, present: true, reason: `${k} must be true` };
  }
  if (method !== 'post') {
    return { ok: false, present: true, reason: 'provider-event exemption applies only to POST' };
  }
  const wh = operation['x-kob-webhook'];
  if (wh === undefined) {
    return { ok: false, present: true, reason: 'x-kob-webhook receiver metadata missing' };
  }
  if (wh === null || typeof wh !== 'object' || Array.isArray(wh)) {
    return { ok: false, present: true, reason: 'x-kob-webhook must be an object' };
  }
  if (wh.receiver !== true) {
    return { ok: false, present: true, reason: 'x-kob-webhook.receiver must be true' };
  }
  if (typeof wh.provider !== 'string' || wh.provider.length === 0) {
    return { ok: false, present: true, reason: 'x-kob-webhook.provider must be a non-empty string' };
  }
  if (wh.provider !== idem.provider) {
    return { ok: false, present: true, reason: 'provider differs between x-kob-webhook and x-kob-idempotency' };
  }
  const sigHeaderName = wh['signature-header'];
  if (typeof sigHeaderName !== 'string' || sigHeaderName.length === 0) {
    return { ok: false, present: true, reason: 'x-kob-webhook.signature-header must be a non-empty string' };
  }
  const allParams = [...(pathItem.parameters || []), ...(operation.parameters || [])]
    .map(resolveParam)
    .filter(Boolean);
  const sigParam = allParams.find(
    (p) => p && (p.in || '').toLowerCase() === 'header'
      && typeof p.name === 'string' && p.name.toLowerCase() === sigHeaderName.toLowerCase(),
  );
  if (!sigParam) {
    return { ok: false, present: true, reason: `required signature header "${sigHeaderName}" not found` };
  }
  if (sigParam.required !== true) {
    return { ok: false, present: true, reason: `signature header "${sigHeaderName}" must be required` };
  }
  const loc = wh['event-id-location'];
  const ptr = wh['event-id-pointer'];
  if (loc !== 'body' && loc !== 'header') {
    return { ok: false, present: true, reason: 'x-kob-webhook.event-id-location must be "body" or "header"' };
  }
  if (typeof ptr !== 'string' || ptr.length === 0) {
    return { ok: false, present: true, reason: 'x-kob-webhook.event-id-pointer must be a non-empty string' };
  }
  if (loc === 'header') {
    const evtParam = allParams.find(
      (p) => p && (p.in || '').toLowerCase() === 'header'
        && typeof p.name === 'string' && p.name.toLowerCase() === ptr.toLowerCase(),
    );
    if (!evtParam) return { ok: false, present: true, reason: `event ID header "${ptr}" not found` };
    if (evtParam.required !== true) return { ok: false, present: true, reason: `event ID header "${ptr}" must be required` };
  } else {
    if (!ptr.startsWith('/')) {
      return { ok: false, present: true, reason: 'event-id-pointer must be a JSON pointer starting with "/"' };
    }
    const rb = operation.requestBody;
    if (!rb) return { ok: false, present: true, reason: 'requestBody missing for event-id-pointer resolution' };
    const body = rb.$ref ? resolveRef(rb.$ref) : rb;
    const schema = body && body.content && body.content['application/json'] && body.content['application/json'].schema;
    if (!schema) return { ok: false, present: true, reason: 'application/json request body schema missing' };
    const rootSchema = schema.$ref ? resolveRef(schema.$ref) : schema;
    if (!rootSchema) return { ok: false, present: true, reason: 'event ID pointer does not resolve (schema unresolved)' };
    const target = jsonPointerLookup(rootSchema, ptr);
    if (target === undefined) return { ok: false, present: true, reason: 'event ID pointer does not resolve' };
    const parts = ptr.slice(1).split('/');
    const leaf = parts[parts.length - 1];
    let parent = rootSchema;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (parent && parent.$ref) parent = resolveRef(parent.$ref);
      parent = parent && parent.properties ? parent.properties[parts[i]] : undefined;
    }
    if (parent && parent.$ref) parent = resolveRef(parent.$ref);
    const required = (parent && parent.required) || [];
    if (!required.includes(leaf)) {
      return { ok: false, present: true, reason: `event ID field "${leaf}" must be listed in required[]` };
    }
  }
  return { ok: true, present: true };
}

function describesWebhookSignature(pathItem, op) {
  // Look at path-level parameters AND operation parameters AND the description text.
  const desc = `${pathItem.description || ''}\n${op.description || ''}\n${op.summary || ''}`.toLowerCase();
  const sigKeywords = ['signature', 'verif-hash', 'stripe-signature', 'paypal-transmission', 'x-kob-signature', 'hmac'];
  const dedupeKeywords = ['dedupe', 'deduplication', 'webhook_inbox', 'event_id', 'idempotent'];
  const hasSigText = sigKeywords.some((k) => desc.includes(k));
  const hasDedupeText = dedupeKeywords.some((k) => desc.includes(k));

  const params = [...(pathItem.parameters || []), ...(op.parameters || [])];
  const headers = params.filter((p) => (p.in || (p.$ref ? 'header' : '')) === 'header').map((p) => (p.name || p.$ref || '').toLowerCase());
  const hasSigHeader = headers.some((h) => /signature|verif-hash|paypal-transmission/.test(h));

  return (hasSigText || hasSigHeader) && hasDedupeText;
}

for (const [pathKey, pathItem] of Object.entries(spec.paths || {})) {
  for (const method of HTTP_METHODS) {
    const op = pathItem[method];
    if (!op) continue;
    const opId = op.operationId || `${method.toUpperCase()} ${pathKey}`;
    const opKey = `${method.toUpperCase()} ${pathKey}`;
    try {

    // G1 — 2xx schema (except 204)
    for (const [code, resp] of Object.entries(op.responses || {})) {
      if (!/^2\d\d$/.test(code) || code === '204') continue;
      const content = resp.content || {};
      const hasJsonSchema = Object.values(content).some((c) => c && c.schema);
      if (!hasJsonSchema) {
        fail('G1', opKey, `${opId}: response ${code} missing schema`);
      }
    }

    // G5 — RFC 7807 errors
    for (const [code, resp] of Object.entries(op.responses || {})) {
      if (!/^[45]\d\d$/.test(code)) continue;
      const content = resp.content || {};
      const usesProblem = !!content['application/problem+json'];
      if (!usesProblem && !resp.$ref) {
        fail('G5', opKey, `${opId}: response ${code} should use application/problem+json (RFC 7807)`);
      }
    }

    // G6 — Conflict + Too Many Requests on every mutation
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      if (!op.responses?.['409']) {
        fail('G6', opKey, `${opId}: mutation missing 409 Conflict response (RFC 7231 §6.5.8)`);
      }
      if (!op.responses?.['429']) {
        fail('G6', opKey, `${opId}: mutation missing 429 Too Many Requests response (RFC 6585 §4)`);
    }

    // G7 — DELETE operations must accept Idempotency-Key (safe replay)
    if (method === 'delete' && !hasIdempotencyKey(op)) {
      fail('G7', opKey, `${opId}: DELETE missing Idempotency-Key header parameter`);
    }
    }

    // G3 — Idempotency-Key on financial mutations, OR a fully-declared
    // provider-event exemption (Phase 1B-R1I-a.2). Naming ("webhook" in path/
    // opId/tag/summary/description) never qualifies — only explicit structured
    // x-kob-idempotency + x-kob-webhook metadata backed by real OpenAPI shape.
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(method);
    const isFinancial = FINANCIAL_PATH_PATTERNS.some((re) => re.test(pathKey));
    if (isMutation && isFinancial && !hasIdempotencyKey(op)) {
      const exemption = hasValidProviderEventIdempotency(op, method, pathKey, pathItem);
      if (!exemption.ok) {
        if (exemption.present) {
          fail('G3', opKey, `${opId}: G3 provider-event exemption invalid: ${exemption.reason}`);
        } else {
          fail('G3', opKey, `${opId}: financial mutation missing Idempotency-Key header`);
        }
      }
    }


    // G4 — pagination on list endpoints (heuristic: GET on collection paths returning arrays/PaginatedResponse)
    if (method === 'get' && !pathKey.includes('{') && !isPaginated(op)) {
      // Only flag when 200 response references something that *looks* paginated.
      const resp200 = op.responses?.['200'];
      const schemaText = JSON.stringify(resp200 || {});
      if (/PaginatedResponse|"type"\s*:\s*"array"/.test(schemaText)) {
        fail('G4', opKey, `${opId}: list endpoint missing cursor/page+limit pagination params`);
      }
    }

    // G2 — webhook receiver paths
    if (WEBHOOK_PATH.test(pathKey) && method === 'post') {
      if (!describesWebhookSignature(pathItem, op)) {
        fail('G2', opKey, `${opId}: webhook receiver missing signature header docs and/or dedupe note`);
      }
    }

    // G8 — cursor parity on paginated list ops (Phase 1)
    if (method === 'get' && isPaginated(op)) {
      const names = new Set((op.parameters || []).map((p) => (p.$ref ? p.$ref.split('/').pop() : p.name)));
      const hasOffset = names.has('offset') || names.has('OffsetParam') || names.has('Offset');
      const hasCursor = names.has('starting_after') || names.has('ending_before') ||
        names.has('StartingAfter') || names.has('EndingBefore') ||
        names.has('cursor') || names.has('CursorParam');
      if (hasOffset && !hasCursor) {
        fail('G8', opKey, `${opId}: paginated list offers offset but no cursor (starting_after/ending_before) — Phase 1 cursor parity`);
      }
    }

    // G9 — X-Request-ID correlation header on every operation (Phase 1)
    const reqIdPresent = (op.parameters || []).some((p) => {
      const name = p.$ref ? p.$ref.split('/').pop() : p.name;
      return name === 'RequestId' || name === 'X-Request-ID' || name === 'x-request-id';
    });
    if (!reqIdPresent) {
      fail('G9', opKey, `${opId}: missing optional X-Request-ID correlation header parameter`);
    }
    } catch (err) {
      // Fail-safe: malformed operation metadata must never abort the sweep.
      fail('G3', opKey, `${opId}: gate evaluation threw ${err && err.message ? err.message : String(err)}`);
    }
  }
}

const totalOps = Object.entries(spec.paths || {})
  .flatMap(([, pi]) => HTTP_METHODS.filter((m) => pi[m]))
  .length;

const summary = {
  spec: specPath,
  apiVersion: spec.info?.version,
  totalOperations: totalOps,
  failures: failures.length,
  byGate: counters,
};

console.log('OpenAPI quality gates — summary');
console.log(JSON.stringify(summary, null, 2));

if (failures.length === 0) {
  console.log('\nAll gates passed.');
  process.exit(0);
}

const grouped = failures.reduce((acc, f) => {
  (acc[f.gate] ||= []).push(`  - ${f.message}`);
  return acc;
}, {});

console.error('\nFailures:');
for (const [gate, list] of Object.entries(grouped)) {
  console.error(`\n[${gate}] ${list.length} failure(s):`);
  console.error(list.slice(0, 50).join('\n'));
  if (list.length > 50) console.error(`  ... and ${list.length - 50} more`);
}
console.error(`\nAdd known acceptable exceptions (with justification) to ${allowExceptionsPath}.`);
process.exit(1);
