// @ts-nocheck — Node imports resolved by vitest
/**
 * CI Ratchet — every operation MUST declare canonical error responses.
 *
 * Policy:
 *   - Authed operations declare 400, 401, 500.
 *   - Public operations (health, JWKS, OIDC discovery, provider webhooks) declare 400, 500.
 *   - Every 4xx/5xx response references one of the canonical error schemas:
 *     `Error`, `ProblemDetails`, `RateLimitError`.
 *
 * Justification:
 *   - RFC 7807 (Problem Details for HTTP APIs).
 *   - Stripe API: documents 4xx/5xx with consistent envelope.
 *   - Standing Order #2 (Ratchet): coverage cannot regress.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

const PUBLIC_PATHS = new Set([
  '/healthz',
  '/v1/health',
  '/v1/ready',
  '/v1/oidc/.well-known/openid-configuration',
  '/v1/jwks',
  '/v1/directory/banks/cm',
]);
const PROVIDER_WEBHOOK_PREFIX = '/v1/webhooks/providers/';
const ALLOWED_ERR = new Set(['Error', 'ProblemDetails', 'RateLimitError']);
const MUT = ['get', 'post', 'put', 'patch', 'delete'];

function refName(s: any): string | undefined {
  return typeof s?.$ref === 'string' ? s.$ref.split('/').pop() : undefined;
}

describe('OpenAPI ratchet — error catalog completeness', () => {
  it('every authed op declares 400, 401, 500; public ops declare 400, 500', () => {
    const offenders: string[] = [];
    for (const [p, methods] of Object.entries<any>(spec.paths || {})) {
      for (const [m, op] of Object.entries<any>(methods)) {
        if (!MUT.includes(m)) continue;
        const codes = Object.keys(op.responses || {});
        const isPublic = PUBLIC_PATHS.has(p) || p.startsWith(PROVIDER_WEBHOOK_PREFIX);
        const isAuthed = !isPublic && (
          (op.security && op.security.length > 0) ||
          (spec.security && spec.security.length > 0)
        );
        const required = isAuthed ? ['400', '401', '500'] : ['400', '500'];
        for (const code of required) {
          if (!codes.includes(code)) offenders.push(`${m.toUpperCase()} ${p} missing ${code}`);
        }
      }
    }
    expect(offenders, `Missing required error codes:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('every 4xx/5xx response references a canonical error schema', () => {
    const offenders: string[] = [];
    for (const [p, methods] of Object.entries<any>(spec.paths || {})) {
      for (const [m, op] of Object.entries<any>(methods)) {
        if (!MUT.includes(m)) continue;
        for (const [code, resp] of Object.entries<any>(op.responses || {})) {
          if (!code.startsWith('4') && !code.startsWith('5')) continue;
          const sch = resp?.content?.['application/json']?.schema;
          if (!sch) {
            offenders.push(`${m.toUpperCase()} ${p} ${code} (no schema)`);
            continue;
          }
          const name = refName(sch);
          if (name && !ALLOWED_ERR.has(name)) {
            offenders.push(`${m.toUpperCase()} ${p} ${code} -> ${name}`);
          }
        }
      }
    }
    expect(offenders, `Non-canonical error responses:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});
