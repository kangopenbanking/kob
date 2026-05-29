// @ts-nocheck
/**
 * Phase 8 ratchet — RFC 7807 promotion.
 *
 * - The ProblemDetails schema must exist.
 * - All three example payloads must be declared in components.examples.
 * - New /v1/payment-intents endpoints must serve application/problem+json
 *   on 4xx/5xx responses.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

describe('Phase 8 — RFC 7807 Problem Details coverage', () => {
  it('declares ProblemDetails schema', () => {
    expect(spec.components?.schemas?.ProblemDetails).toBeDefined();
  });

  it('declares Conflict / Validation / RateLimited examples', () => {
    expect(spec.components?.examples?.ProblemDetailsConflict).toBeDefined();
    expect(spec.components?.examples?.ProblemDetailsValidation).toBeDefined();
    expect(spec.components?.examples?.ProblemDetailsRateLimited).toBeDefined();
  });

  it('every new payment-intent endpoint emits application/problem+json on 4xx', () => {
    const offenders: string[] = [];
    const newPaths = [
      '/v1/payment-intents',
      '/v1/payment-intents/{id}',
      '/v1/payment-intents/{id}/confirm',
      '/v1/payment-intents/{id}/cancel',
    ];
    for (const p of newPaths) {
      const methods = spec.paths?.[p];
      if (!methods) {
        offenders.push(`${p} missing`);
        continue;
      }
      for (const [m, op] of Object.entries<any>(methods)) {
        if (!['get', 'post'].includes(m)) continue;
        for (const [code, resp] of Object.entries<any>(op.responses || {})) {
          if (!/^[45]\d\d$/.test(code)) continue;
          if (!resp.content?.['application/problem+json']) {
            offenders.push(`${m.toUpperCase()} ${p} → ${code} missing problem+json`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
