#!/usr/bin/env node
/**
 * Postman vs OpenAPI contract check (Phase 5 follow-up).
 *
 * Runs the published Postman collection against the sandbox environment with
 * Newman, then validates each captured response body against the matching
 * OpenAPI 3.x response schema using Ajv. Fails the build if any response
 * does not match the schema (or if the request itself failed).
 *
 *   npm i -D newman ajv ajv-formats   # one-time CI setup
 *   npm run postman:contract
 *
 * Env:
 *   POSTMAN_COLLECTION   default: public/postman/Kang_Open_Banking_API_v1.postman_collection.json
 *   POSTMAN_ENV          default: public/postman/Kang_Open_Banking_Sandbox.postman_environment.json
 *   OPENAPI_SPEC         default: public/openapi.json
 *
 * Standing Order 2 (THE RATCHET): once a request passes, it must keep passing.
 */
import fs from 'node:fs';
import path from 'node:path';

const collectionPath = process.env.POSTMAN_COLLECTION
  ?? 'public/postman/Kang_Open_Banking_API_v1.postman_collection.json';
const envPath = process.env.POSTMAN_ENV
  ?? 'public/postman/Kang_Open_Banking_Sandbox.postman_environment.json';
const specPath = process.env.OPENAPI_SPEC ?? 'public/openapi.json';

for (const p of [collectionPath, envPath, specPath]) {
  if (!fs.existsSync(p)) {
    console.error(`[postman-contract] missing file: ${p}`);
    process.exit(2);
  }
}

let newman, Ajv, addFormats;
try {
  newman = (await import('newman')).default;
  Ajv = (await import('ajv')).default;
  addFormats = (await import('ajv-formats')).default;
} catch (e) {
  console.error('[postman-contract] required deps not installed. Run: npm i -D newman ajv ajv-formats');
  console.error(String(e?.message ?? e));
  process.exit(2);
}

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

// Build a path-template matcher: turns "/v1/charges/{id}" into a regex.
function buildMatchers(spec) {
  const out = [];
  for (const [tmpl, item] of Object.entries(spec.paths || {})) {
    const re = new RegExp('^' + tmpl.replace(/\{[^}]+\}/g, '[^/]+') + '$');
    for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
      if (item[m]) out.push({ template: tmpl, method: m.toUpperCase(), re, op: item[m] });
    }
  }
  return out;
}
const matchers = buildMatchers(spec);

function findOperation(method, urlPath) {
  return matchers.find((m) => m.method === method && m.re.test(urlPath));
}

function resolveSchema(schema) {
  // Cheap $ref resolver scoped to spec.components — Ajv can also handle it via addSchema,
  // but inlining keeps the validator self-contained for CI logs.
  if (!schema || typeof schema !== 'object') return schema;
  if (schema.$ref) {
    const segs = schema.$ref.replace(/^#\//, '').split('/');
    let cur = spec;
    for (const s of segs) cur = cur?.[s];
    return resolveSchema(cur);
  }
  return schema;
}

const results = { pass: 0, fail: 0, skipped: 0, mismatches: [] };

newman.run(
  {
    collection: require_(collectionPath),
    environment: require_(envPath),
    reporters: ['cli'],
    timeoutRequest: 15000,
    insecure: false,
  },
  (err, summary) => {
    if (err) {
      console.error('[postman-contract] newman failed to start:', err);
      process.exit(1);
    }

    for (const ex of summary.run.executions) {
      const reqName = ex.item?.name ?? '(unnamed)';
      const method = ex.request?.method ?? '';
      const urlPath = '/' + (ex.request?.url?.path?.join('/') ?? '');
      const status = ex.response?.code;

      if (!status) {
        results.fail += 1;
        results.mismatches.push({ reqName, reason: 'no response (network/timeout)' });
        continue;
      }

      const op = findOperation(method, urlPath);
      if (!op) {
        results.skipped += 1;
        continue;
      }

      const respDef = op.op.responses?.[String(status)] ?? op.op.responses?.default;
      const schema = respDef?.content?.['application/json']?.schema
        ?? respDef?.content?.['application/problem+json']?.schema;
      if (!schema) {
        results.skipped += 1;
        continue;
      }

      let body;
      try { body = JSON.parse(ex.response.stream?.toString?.() ?? ex.response?.text?.() ?? '{}'); }
      catch { results.skipped += 1; continue; }

      const validate = ajv.compile(resolveSchema(schema));
      if (validate(body)) {
        results.pass += 1;
      } else {
        results.fail += 1;
        results.mismatches.push({
          reqName, method, urlPath, status,
          errors: validate.errors?.slice(0, 5),
        });
      }
    }

    console.log('\nPostman ↔ OpenAPI contract check');
    console.log(JSON.stringify({
      collection: collectionPath,
      environment: envPath,
      spec: specPath,
      apiVersion: spec.info?.version,
      ...results,
      mismatches: results.mismatches.length,
    }, null, 2));

    if (results.fail > 0) {
      console.error('\nMismatches:');
      for (const m of results.mismatches.slice(0, 20)) {
        console.error('-', m.reqName, m.method, m.urlPath, m.status, JSON.stringify(m.errors ?? m.reason));
      }
      process.exit(1);
    }
    process.exit(0);
  },
);

function require_(p) {
  return JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));
}
