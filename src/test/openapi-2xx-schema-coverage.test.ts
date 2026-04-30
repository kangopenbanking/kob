// @ts-nocheck — Node imports resolved by vitest, not app tsconfig
/**
 * CI Ratchet — every non-204 2xx response MUST declare a content schema.
 *
 * Justification: OpenAPI 3.1.0 §4.7.13 (Response Object) — typed bodies require
 * `content[mediaType].schema`. Stripe-grade SDK generators (oapi-codegen, openapi-generator)
 * silently emit `unknown` for missing schemas, breaking type safety end-to-end.
 *
 * Standing Order #2 (The Ratchet): once a 2xx is typed, it can never be untyped again.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

describe('OpenAPI ratchet — 2xx schema coverage', () => {
  it('every non-204 2xx response has a typed content schema', () => {
    const offenders: string[] = [];
    for (const [pathKey, methods] of Object.entries<any>(spec.paths || {})) {
      for (const [method, op] of Object.entries<any>(methods)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        const responses = op.responses || {};
        for (const [code, resp] of Object.entries<any>(responses)) {
          if (!/^2\d\d$/.test(code)) continue;
          if (code === '204') continue;
          const content = resp?.content || {};
          const hasSchema = Object.values<any>(content).some((c) => c && c.schema);
          if (!hasSchema) {
            offenders.push(`${method.toUpperCase()} ${pathKey} -> ${code}`);
          }
        }
      }
    }
    expect(offenders, `Operations missing 2xx schema:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});
