// Regenerate Postman static export from public/openapi.json
// Phase 5d — keeps collection in sync with spec contracts.
//
// Output:
//   public/postman/Kang_Open_Banking_API_v1.postman_collection.json
//
// Each operation becomes a request. Operations are grouped by primary tag.
// Body examples are taken from requestBody.content['application/json'].example
// when present, else generated from the schema's example fields.

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

const BASE_URL = '{{base_url}}';
const HEADERS_AUTH = [
  { key: 'Authorization', value: 'Bearer {{access_token}}', type: 'text' },
  { key: 'Accept', value: 'application/json', type: 'text' },
];

function resolveRef(ref) {
  if (!ref || typeof ref !== 'string') return null;
  const parts = ref.replace(/^#\//, '').split('/');
  let cur = spec;
  for (const p of parts) cur = cur?.[p];
  return cur;
}

function exampleFromSchema(schema, depth = 0) {
  if (!schema || depth > 4) return null;
  if (schema.$ref) return exampleFromSchema(resolveRef(schema.$ref), depth + 1);
  if (schema.example !== undefined) return schema.example;
  if (schema.allOf) {
    const merged = {};
    for (const sub of schema.allOf) {
      const v = exampleFromSchema(sub, depth + 1);
      if (v && typeof v === 'object') Object.assign(merged, v);
    }
    return Object.keys(merged).length ? merged : null;
  }
  if (schema.type === 'object' || schema.properties) {
    const obj = {};
    for (const [k, v] of Object.entries(schema.properties || {})) {
      const ex = exampleFromSchema(v, depth + 1);
      if (ex !== null && ex !== undefined) obj[k] = ex;
    }
    return obj;
  }
  if (schema.type === 'array') {
    const item = exampleFromSchema(schema.items, depth + 1);
    return item !== null ? [item] : [];
  }
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'string') {
    if (schema.format === 'uuid') return '00000000-0000-4000-8000-000000000000';
    if (schema.format === 'date-time') return '2026-04-30T00:00:00Z';
    if (schema.format === 'email') return 'test@example.com';
    return 'string';
  }
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'boolean') return false;
  return null;
}

function pathToUrl(p) {
  // Convert /v1/foo/{id} → {{base_url}}/v1/foo/:id
  return BASE_URL + p.replace(/\{([^}]+)\}/g, ':$1');
}

function pathVariables(p) {
  const matches = p.match(/\{([^}]+)\}/g) || [];
  return matches.map((m) => ({ key: m.slice(1, -1), value: '' }));
}

function resolveParam(p) {
  if (p.$ref) return resolveRef(p.$ref) || p;
  return p;
}

function makeRequest(p, method, op, pathItem) {
  const allParams = [...(pathItem.parameters || []), ...(op.parameters || [])].map(resolveParam);
  const queryParams = allParams.filter((x) => x.in === 'query').map((x) => ({
    key: x.name,
    value: '',
    description: x.description || '',
    disabled: !x.required,
  }));
  const headerParams = allParams
    .filter((x) => x.in === 'header')
    .map((x) => ({
      key: x.name,
      value: x.schema?.example || '',
      type: 'text',
      description: x.description || '',
      disabled: !x.required,
    }));

  const headers = [...HEADERS_AUTH, ...headerParams];
  let body;
  if (op.requestBody) {
    const json = op.requestBody.content?.['application/json'];
    if (json) {
      headers.push({ key: 'Content-Type', value: 'application/json', type: 'text' });
      const ex = json.example ?? exampleFromSchema(json.schema);
      body = {
        mode: 'raw',
        raw: JSON.stringify(ex ?? {}, null, 2),
        options: { raw: { language: 'json' } },
      };
    }
  }

  return {
    name: op.operationId || `${method.toUpperCase()} ${p}`,
    request: {
      method: method.toUpperCase(),
      header: headers,
      url: {
        raw: pathToUrl(p) + (queryParams.length ? '?' + queryParams.map((q) => `${q.key}=`).join('&') : ''),
        host: [BASE_URL],
        path: p.split('/').filter(Boolean).map((seg) => seg.replace(/\{([^}]+)\}/, ':$1')),
        query: queryParams,
        variable: pathVariables(p),
      },
      description: op.summary || op.description || '',
      ...(body ? { body } : {}),
    },
    response: [],
  };
}

// Group by primary tag
const folders = new Map();
const HTTP = ['get', 'post', 'put', 'patch', 'delete'];

for (const [p, methods] of Object.entries(spec.paths || {})) {
  for (const [m, op] of Object.entries(methods)) {
    if (!HTTP.includes(m)) continue;
    const tag = (op.tags && op.tags[0]) || 'Other';
    if (!folders.has(tag)) folders.set(tag, []);
    folders.get(tag).push(makeRequest(p, m, op, methods));
  }
}

const items = [...folders.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([tag, requests]) => ({
    name: tag,
    item: requests.sort((a, b) => a.name.localeCompare(b.name)),
  }));

const collection = {
  info: {
    _postman_id: 'kob-api-v1',
    name: 'Kang Open Banking API v1',
    description:
      `Auto-generated from OpenAPI ${spec.info.version}.\n\n` +
      'Base URLs:\n' +
      '  - Sandbox:    https://sandbox-api.kangopenbanking.com/v1\n' +
      '  - Production: https://api.kangopenbanking.com/v1\n\n' +
      'Set `base_url` and `access_token` (or `api_key`) in the environment.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    version: spec.info.version,
  },
  item: items,
  variable: [
    { key: 'base_url', value: 'https://sandbox-api.kangopenbanking.com/v1' },
    { key: 'access_token', value: '' },
  ],
};

const outPath = path.join(root, 'public/postman/Kang_Open_Banking_API_v1.postman_collection.json');
fs.writeFileSync(outPath, JSON.stringify(collection, null, 2) + '\n');

const total = items.reduce((n, f) => n + f.item.length, 0);
console.log(`Postman collection regenerated: ${items.length} folders, ${total} requests`);
console.log(`Wrote: ${outPath}`);
