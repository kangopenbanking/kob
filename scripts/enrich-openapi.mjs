#!/usr/bin/env node
/**
 * Enrich OpenAPI spec with Stripe-grade richness:
 *  - Adds reusable components.examples (success + RFC 7807 errors)
 *  - Wires response examples to every operation/response (success + error codes)
 *  - Adds x-codeSamples (cURL, Node.js, Python, PHP) to every operation
 *  - Expands thin operation descriptions
 *  - Adds OAS 3.1 webhooks (PIS, AIS, payouts, refunds) — kept under x-webhooks
 *    in 3.0 spec for tooling that only supports 3.0
 *  - Adds reusable components.responses for common error shapes
 *  - Bumps info.version (patch)
 *  - Writes both openapi.json and openapi.yaml
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'public/openapi.json');
const YAML_PATH = path.join(ROOT, 'public/openapi.yaml');

const spec = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

/* ---------- 1. Reusable examples ---------- */
spec.components.examples = spec.components.examples || {};
const E = spec.components.examples;

E.GenericSuccess = {
  summary: 'Successful response envelope',
  value: {
    success: true,
    data: { id: 'obj_01HZX9TRJ4M7YQK6P3W2VBDN5K', object: 'resource', created_at: '2026-05-02T10:15:30Z' },
    meta: { request_id: 'req_01HZX9TRJ4M7YQK6P3W2VBDN5K', timestamp: '2026-05-02T10:15:30Z' }
  }
};

E.PaginatedList = {
  summary: 'Cursor-paginated list',
  value: {
    success: true,
    data: [
      { id: 'obj_01HZX9TRJ4M7YQK6P3W2VBDN5K', object: 'resource', created_at: '2026-05-02T10:15:30Z' },
      { id: 'obj_01HZX9TRJ4M7YQK6P3W2VBDN5L', object: 'resource', created_at: '2026-05-02T10:15:31Z' }
    ],
    pagination: {
      has_more: true,
      next_cursor: 'cursor_01HZX9TRJ4M7YQK6P3W2VBDN5M',
      prev_cursor: null,
      total_count: 247
    },
    meta: { request_id: 'req_01HZX9TRJ4M7YQK6P3W2VBDN5K', timestamp: '2026-05-02T10:15:30Z' }
  }
};

const problem = (status, title, code, detail) => ({
  summary: `${status} ${title}`,
  value: {
    type: `https://docs.kangopenbanking.com/errors/${code}`,
    title, status, code, detail,
    instance: '/v1/resource/01HZX9TRJ4M7YQK6P3W2VBDN5K',
    request_id: 'req_01HZX9TRJ4M7YQK6P3W2VBDN5K',
    timestamp: '2026-05-02T10:15:30Z'
  }
});

E.ErrorBadRequest    = problem(400, 'Bad Request',           'invalid_request',     'The request body failed validation. See errors[] for field-level detail.');
E.ErrorUnauthorized  = problem(401, 'Unauthorized',          'invalid_credentials', 'Missing or invalid bearer token. Authenticate at /v1/oauth/token.');
E.ErrorForbidden     = problem(403, 'Forbidden',             'insufficient_scope',  'The access token is missing the required scope for this operation.');
E.ErrorNotFound      = problem(404, 'Not Found',             'resource_not_found',  'The requested resource does not exist or has been archived.');
E.ErrorConflict      = problem(409, 'Conflict',              'idempotency_conflict','Idempotency-Key was reused with a different request body.');
E.ErrorUnprocessable = problem(422, 'Unprocessable Entity',  'business_rule_violation', 'The request was syntactically valid but violates a business rule (e.g. insufficient funds).');
E.ErrorRateLimited   = problem(429, 'Too Many Requests',     'rate_limited',        'Request quota exceeded. Retry after the period indicated by Retry-After.');
E.ErrorServer        = problem(500, 'Internal Server Error', 'internal_error',      'An unexpected error occurred. The incident has been logged with request_id.');
E.ErrorUnavailable   = problem(503, 'Service Unavailable',   'service_unavailable', 'A downstream dependency is temporarily unavailable. Retry with exponential backoff.');

// Domain-specific success examples
E.PaymentIntentCreated = {
  summary: 'Payment intent created',
  value: {
    success: true,
    data: {
      id: 'pi_01HZX9TRJ4M7YQK6P3W2VBDN5K',
      object: 'payment_intent',
      amount: '5000',
      currency: 'XAF',
      status: 'requires_confirmation',
      client_secret: 'pi_01HZX9TRJ4M7YQK6P3W2VBDN5K_secret_aBc123',
      payment_method_types: ['mobile_money', 'card', 'bank_transfer'],
      idempotency_key: '550e8400-e29b-41d4-a716-446655440000',
      created_at: '2026-05-02T10:15:30Z'
    },
    meta: { request_id: 'req_01HZX9TRJ4M7YQK6P3W2VBDN5K', timestamp: '2026-05-02T10:15:30Z' }
  }
};

E.AccountBalance = {
  summary: 'Account balance snapshot',
  value: {
    success: true,
    data: {
      account_id: 'acc_01HZX9TRJ4M7YQK6P3W2VBDN5K',
      currency: 'XAF',
      balances: [
        { type: 'ClosingAvailable', amount: '125000', credit_debit_indicator: 'Credit', datetime: '2026-05-02T10:15:30Z' },
        { type: 'ClosingBooked',    amount: '130000', credit_debit_indicator: 'Credit', datetime: '2026-05-02T10:15:30Z' }
      ]
    },
    meta: { request_id: 'req_01HZX9TRJ4M7YQK6P3W2VBDN5K', timestamp: '2026-05-02T10:15:30Z' }
  }
};

/* ---------- 2. Reusable error responses ---------- */
const errorRef = (exampleKey, headers) => ({
  description: E[exampleKey].summary,
  headers: headers || {},
  content: {
    'application/problem+json': {
      schema: { $ref: '#/components/schemas/Error' },
      examples: { default: { $ref: `#/components/examples/${exampleKey}` } }
    }
  }
});

const rateHeaders = {
  'X-RateLimit-Limit':     { $ref: '#/components/headers/XRateLimitLimit' },
  'X-RateLimit-Remaining': { $ref: '#/components/headers/XRateLimitRemaining' },
  'X-RateLimit-Reset':     { $ref: '#/components/headers/XRateLimitReset' },
  'Retry-After':           { $ref: '#/components/headers/RetryAfter' }
};

spec.components.responses = spec.components.responses || {};
const R = spec.components.responses;
R.BadRequest          = errorRef('ErrorBadRequest');
R.Unauthorized        = errorRef('ErrorUnauthorized');
R.Forbidden           = errorRef('ErrorForbidden');
R.NotFound            = errorRef('ErrorNotFound');
R.Conflict            = errorRef('ErrorConflict');
R.UnprocessableEntity = errorRef('ErrorUnprocessable');
R.TooManyRequests     = errorRef('ErrorRateLimited', rateHeaders);
R.InternalServerError = errorRef('ErrorServer');
R.ServiceUnavailable  = errorRef('ErrorUnavailable');

const ERROR_EXAMPLE_BY_CODE = {
  '400': 'ErrorBadRequest',
  '401': 'ErrorUnauthorized',
  '403': 'ErrorForbidden',
  '404': 'ErrorNotFound',
  '409': 'ErrorConflict',
  '422': 'ErrorUnprocessable',
  '429': 'ErrorRateLimited',
  '500': 'ErrorServer',
  '503': 'ErrorUnavailable'
};

/* ---------- 3. Per-operation enrichment ---------- */
const SERVER = (spec.servers && spec.servers[0] && spec.servers[0].url) || 'https://api.kangopenbanking.com/v1';

function pickSuccessExample(op, path) {
  const tags = (op.tags || []).map(t => t.toLowerCase()).join(' ');
  const opId = (op.operationId || '').toLowerCase();
  const p = path.toLowerCase();
  if (p.includes('balance') || opId.includes('balance')) return 'AccountBalance';
  if (p.includes('payment') || opId.includes('payment') || tags.includes('payments') || tags.includes('payment intent')) return 'PaymentIntentCreated';
  if ((op._method === 'get') && (p.endsWith('s') || p.includes('/list') || opId.startsWith('list'))) return 'PaginatedList';
  return 'GenericSuccess';
}

function buildCurl(method, path, op) {
  const url = `${SERVER}${path}`;
  const m = method.toUpperCase();
  const lines = [`curl -X ${m} "${url}" \\`,
    `  -H "Authorization: Bearer $KOB_API_KEY" \\`,
    `  -H "X-Request-Id: $(uuidgen)"`];
  if (['POST','PUT','PATCH'].includes(m)) {
    lines[lines.length-1] += ' \\';
    lines.push(`  -H "Idempotency-Key: $(uuidgen)" \\`);
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '{"amount":"5000","currency":"XAF"}'`);
  }
  return lines.join('\n');
}

function buildNode(method, path) {
  return `import { KangClient } from '@kangopenbanking/sdk';

const kang = new KangClient({ apiKey: process.env.KOB_API_KEY });

const response = await kang.request({
  method: '${method.toUpperCase()}',
  path: '${path}',${['POST','PUT','PATCH'].includes(method.toUpperCase()) ? `
  body: { amount: '5000', currency: 'XAF' },
  idempotencyKey: crypto.randomUUID(),` : ''}
});

console.log(response.data);`;
}

function buildPython(method, path) {
  return `from kangopenbanking import Kang
import os, uuid

kang = Kang(api_key=os.environ["KOB_API_KEY"])

response = kang.request(
    method="${method.toUpperCase()}",
    path="${path}",${['POST','PUT','PATCH'].includes(method.toUpperCase()) ? `
    body={"amount": "5000", "currency": "XAF"},
    idempotency_key=str(uuid.uuid4()),` : ''}
)

print(response.data)`;
}

function buildPhp(method, path) {
  return `<?php
require 'vendor/autoload.php';

$kang = new \\KangOpenBanking\\Client(getenv('KOB_API_KEY'));

$response = $kang->request([
    'method' => '${method.toUpperCase()}',
    'path'   => '${path}',${['POST','PUT','PATCH'].includes(method.toUpperCase()) ? `
    'body'   => ['amount' => '5000', 'currency' => 'XAF'],
    'idempotency_key' => \\Ramsey\\Uuid\\Uuid::uuid4()->toString(),` : ''}
]);

print_r($response->data);`;
}

function ensureDescription(op, method, path) {
  const tag = (op.tags && op.tags[0]) || 'API';
  const summary = op.summary || `${method.toUpperCase()} ${path}`;
  if (!op.description || op.description.length < 80) {
    op.description = [
      `${summary}.`,
      ``,
      `**Tag:** ${tag}`,
      ``,
      `Authenticate with a bearer token issued by \`/v1/oauth/token\`. All state-changing requests`,
      `(POST, PUT, PATCH, DELETE) MUST include an \`Idempotency-Key\` header (UUID v4) to make`,
      `retries safe — Kang will return the original response for any duplicate key within 24 hours.`,
      ``,
      `Errors follow [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807) and are returned with`,
      `\`Content-Type: application/problem+json\`. The \`code\` field is stable and machine-readable.`,
      `Rate-limit headers (\`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`)`,
      `are present on every response.`
    ].join('\n');
  }
}

const counters = {
  ops: 0, examplesAdded: 0, codeSamplesAdded: 0, descsExpanded: 0
};

for (const [pathKey, item] of Object.entries(spec.paths)) {
  for (const method of ['get','post','put','patch','delete']) {
    const op = item[method];
    if (!op) continue;
    counters.ops++;
    op._method = method;

    // Description
    const before = op.description || '';
    ensureDescription(op, method, pathKey);
    if ((op.description || '').length > before.length) counters.descsExpanded++;

    // x-codeSamples (Redoc convention)
    if (!op['x-codeSamples'] || op['x-codeSamples'].length === 0) {
      op['x-codeSamples'] = [
        { lang: 'cURL',    label: 'cURL',       source: buildCurl(method, pathKey, op) },
        { lang: 'JavaScript', label: 'Node.js', source: buildNode(method, pathKey) },
        { lang: 'Python',  label: 'Python',     source: buildPython(method, pathKey) },
        { lang: 'PHP',     label: 'PHP',        source: buildPhp(method, pathKey) }
      ];
      counters.codeSamplesAdded++;
    }

    // Examples on every response
    const successKey = pickSuccessExample(op, pathKey);
    const responses = op.responses || {};
    for (const [code, resp] of Object.entries(responses)) {
      if (!resp || typeof resp !== 'object') continue;
      if (resp.$ref) continue; // referenced response — skip injection
      resp.content = resp.content || {};

      const isSuccess = String(code).startsWith('2');
      const isError = /^[45]/.test(String(code));

      if (isSuccess) {
        // Ensure JSON content
        const ct = resp.content['application/json'] || (resp.content['application/json'] = {});
        if (!ct.examples && !ct.example) {
          ct.examples = { default: { $ref: `#/components/examples/${successKey}` } };
          counters.examplesAdded++;
        }
        // Standard rate-limit headers on success
        resp.headers = resp.headers || {};
        for (const h of ['X-RateLimit-Limit','X-RateLimit-Remaining','X-RateLimit-Reset']) {
          if (!resp.headers[h]) resp.headers[h] = { $ref: `#/components/headers/${h.replace(/-/g,'')}` };
        }
      } else if (isError) {
        const exampleKey = ERROR_EXAMPLE_BY_CODE[String(code)] || 'ErrorBadRequest';
        // Replace/augment with problem+json variant carrying example
        const ct = resp.content['application/problem+json'] || (resp.content['application/problem+json'] = {});
        if (!ct.schema) ct.schema = { $ref: '#/components/schemas/Error' };
        if (!ct.examples && !ct.example) {
          ct.examples = { default: { $ref: `#/components/examples/${exampleKey}` } };
          counters.examplesAdded++;
        }
        if (String(code) === '429') {
          resp.headers = resp.headers || {};
          if (!resp.headers['Retry-After']) resp.headers['Retry-After'] = { $ref: '#/components/headers/RetryAfter' };
        }
      }
    }

    delete op._method;
  }
}

/* ---------- 4. Webhooks (kept under x-webhooks for OAS 3.0 tooling) ---------- */
const webhookEvent = (eventName, summary, dataExample) => ({
  post: {
    summary,
    description: `Kang POSTs this event to your registered webhook URL. Verify the \`X-Kang-Signature\` HMAC-SHA256 header before processing. See [Webhook signature verification](https://kangopenbanking.com/developer/webhooks/signatures).`,
    operationId: `webhook${eventName.replace(/[^a-zA-Z0-9]/g,'')}`,
    tags: ['Webhooks'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['id','type','created_at','data'],
            properties: {
              id:         { type: 'string', example: 'evt_01HZX9TRJ4M7YQK6P3W2VBDN5K' },
              type:       { type: 'string', example: eventName },
              created_at: { type: 'string', format: 'date-time' },
              livemode:   { type: 'boolean', example: false },
              data:       { type: 'object' }
            }
          },
          examples: {
            default: {
              summary: `${eventName} payload`,
              value: {
                id: 'evt_01HZX9TRJ4M7YQK6P3W2VBDN5K',
                type: eventName,
                created_at: '2026-05-02T10:15:30Z',
                livemode: false,
                data: dataExample
              }
            }
          }
        }
      }
    },
    responses: {
      '200': { description: 'Acknowledged. Return 2xx within 10 seconds; otherwise Kang retries with exponential backoff up to 7 attempts.' }
    }
  }
});

spec['x-webhooks'] = {
  'payment_intent.succeeded':    webhookEvent('payment_intent.succeeded', 'Payment intent successfully captured', { id: 'pi_01HZX9TRJ4M7YQK6P3W2VBDN5K', amount: '5000', currency: 'XAF', status: 'succeeded' }),
  'payment_intent.failed':       webhookEvent('payment_intent.failed',    'Payment intent failed',                  { id: 'pi_01HZX9TRJ4M7YQK6P3W2VBDN5K', amount: '5000', currency: 'XAF', status: 'failed', failure_code: 'insufficient_funds' }),
  'refund.created':              webhookEvent('refund.created',           'Refund initiated',                       { id: 'rf_01HZX9TRJ4M7YQK6P3W2VBDN5K', payment_intent_id: 'pi_01HZX9TRJ4M7YQK6P3W2VBDN5K', amount: '5000', currency: 'XAF', status: 'pending' }),
  'payout.paid':                 webhookEvent('payout.paid',              'Payout settled to bank account',         { id: 'po_01HZX9TRJ4M7YQK6P3W2VBDN5K', amount: '125000', currency: 'XAF', destination: 'acc_01HZX9TRJ4M7YQK6P3W2VBDN5K', status: 'paid' }),
  'consent.authorized':          webhookEvent('consent.authorized',       'AISP/PISP consent authorized by PSU',     { id: 'cns_01HZX9TRJ4M7YQK6P3W2VBDN5K', status: 'Authorised', expires_at: '2026-08-02T10:15:30Z' }),
  'consent.revoked':             webhookEvent('consent.revoked',          'AISP/PISP consent revoked by PSU',        { id: 'cns_01HZX9TRJ4M7YQK6P3W2VBDN5K', status: 'Revoked' }),
  'account.balance.updated':     webhookEvent('account.balance.updated',  'Account balance changed',                 { account_id: 'acc_01HZX9TRJ4M7YQK6P3W2VBDN5K', currency: 'XAF', closing_available: '125000' }),
  'kyc.verification.completed':  webhookEvent('kyc.verification.completed','KYC/KYB verification finished',          { customer_id: 'cus_01HZX9TRJ4M7YQK6P3W2VBDN5K', status: 'verified', tier: 2 })
};

/* ---------- 5. Bump version ---------- */
const [maj, min, pat] = (spec.info.version || '4.27.1').split('.').map(n => parseInt(n,10));
spec.info.version = `${maj}.${min}.${pat + 1}`;

/* ---------- 6. Write outputs ---------- */
fs.writeFileSync(JSON_PATH, JSON.stringify(spec, null, 2) + '\n');

// Minimal JSON->YAML serializer (pure, no deps) — sufficient for OpenAPI shape.
function toYaml(value, indent = 0) {
  const pad = '  '.repeat(indent);
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value === '') return "''";
    if (/^[\s\-?:,\[\]\{\}#&*!|>'"%@`]/.test(value) || /[:#]\s/.test(value) || /\n/.test(value) ||
        /^(true|false|null|yes|no|on|off|~)$/i.test(value) || /^-?\d/.test(value)) {
      // Use block scalar for multi-line, double-quoted otherwise
      if (value.includes('\n')) {
        const lines = value.split('\n');
        return '|-\n' + lines.map(l => '  '.repeat(indent + 1) + l).join('\n');
      }
      return JSON.stringify(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return '\n' + value.map(v => {
      const rendered = toYaml(v, indent + 1);
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        // Inline first key on the dash line
        const inner = rendered.startsWith('\n') ? rendered.slice(1) : rendered;
        const lines = inner.split('\n');
        return pad + '- ' + lines[0].trimStart() + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '');
      }
      return pad + '- ' + (rendered.startsWith('\n') ? rendered.trim() : rendered);
    }).join('\n');
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    return '\n' + keys.map(k => {
      const v = value[k];
      const key = /^[A-Za-z_][\w./:+-]*$/.test(k) ? k : JSON.stringify(k);
      const rendered = toYaml(v, indent + 1);
      if (typeof v === 'object' && v !== null) {
        return pad + key + ':' + rendered;
      }
      return pad + key + ': ' + rendered;
    }).join('\n');
  }
  return JSON.stringify(value);
}

let yaml = '# Generated from openapi.json — do not edit by hand.\n';
yaml += `openapi: ${JSON.stringify(spec.openapi)}\n`;
const rest = { ...spec };
delete rest.openapi;
for (const [k, v] of Object.entries(rest)) {
  const rendered = toYaml(v, 1);
  if (typeof v === 'object' && v !== null) {
    yaml += `${k}:${rendered}\n`;
  } else {
    yaml += `${k}: ${rendered}\n`;
  }
}
fs.writeFileSync(YAML_PATH, yaml);

console.log(JSON.stringify({
  newVersion: spec.info.version,
  totalOps: counters.ops,
  examplesAdded: counters.examplesAdded,
  codeSamplesAdded: counters.codeSamplesAdded,
  descriptionsExpanded: counters.descsExpanded,
  webhookEvents: Object.keys(spec['x-webhooks']).length,
  jsonBytes: fs.statSync(JSON_PATH).size,
  yamlBytes: fs.statSync(YAML_PATH).size
}, null, 2));
