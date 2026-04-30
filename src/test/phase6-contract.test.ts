/**
 * Phase 6 — Contract Tests (CI gate)
 * ----------------------------------
 *  - OpenAPI document parses + has required top-level keys
 *  - Every operation declares at least one 2xx response
 *  - Every 2xx response has a JSON content schema (no schema-less successes)
 *
 * NOTE: Companion ratchet files cover deeper guarantees:
 *   - openapi-2xx-schema-coverage.test.ts
 *   - openapi-operation-id-uniqueness.test.ts
 *   - openapi-security-declared.test.ts
 *   - openapi-pagination-coverage.test.ts
 *   - openapi-error-catalog-coverage.test.ts
 *   - openapi-idempotency-coverage.test.ts
 * This Phase 6 file is the SUMMARY gate that MUST stay green in CI.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SPEC_PATHS = ['public/openapi.json', 'public/openapi-sandbox.json'];
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace'] as const;

function loadSpec(rel: string) {
  const p = path.resolve(process.cwd(), rel);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

describe.each(SPEC_PATHS)('Phase 6 · OpenAPI contract — %s', (rel) => {
  const spec = loadSpec(rel);

  it('parses and has required top-level keys', () => {
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info?.version).toBeTruthy();
    expect(spec.paths).toBeTruthy();
    expect(spec.components).toBeTruthy();
  });

  it('every operation declares at least one 2xx response', () => {
    const offenders: string[] = [];
    for (const [pathName, item] of Object.entries<any>(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const op = item?.[method];
        if (!op) continue;
        const codes = Object.keys(op.responses || {});
        const has2xx = codes.some((c) => /^2\d\d$/.test(c) || c === '2XX');
        if (!has2xx) offenders.push(`${method.toUpperCase()} ${pathName} (${op.operationId || '?'})`);
      }
    }
    expect(offenders, `Operations missing 2xx:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('every 2xx response declares a JSON content schema', () => {
    const offenders: string[] = [];
    for (const [pathName, item] of Object.entries<any>(spec.paths)) {
      for (const method of HTTP_METHODS) {
        const op = item?.[method];
        if (!op) continue;
        for (const [code, resp] of Object.entries<any>(op.responses || {})) {
          if (!/^2\d\d$/.test(code)) continue;
          if (code === '204') continue; // No Content is allowed schema-less
          const content = resp?.content || {};
          const json = content['application/json'] || content['application/problem+json'] || content['text/csv'];
          const hasSchema = json?.schema && (json.schema.$ref || json.schema.type || json.schema.oneOf || json.schema.allOf || json.schema.anyOf || json.schema.properties);
          if (!hasSchema) offenders.push(`${method.toUpperCase()} ${pathName} ${code} (${op.operationId || '?'})`);
        }
      }
    }
    expect(offenders, `2xx responses missing schema:\n${offenders.join('\n')}`).toEqual([]);
  });
});
