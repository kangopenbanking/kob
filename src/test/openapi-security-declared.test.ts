// @ts-nocheck — Node imports resolved by vitest, not app tsconfig
/**
 * CI Ratchet — every operation MUST declare its security requirement
 * (either via op.security[] or globally via spec.security[]).
 *
 * Justification: OpenAPI 3.1.0 §4.7.10.7 + FAPI 1.0 Advanced §5.2.2 — every
 * authenticated endpoint must self-describe its auth scheme so SDK
 * generators can wire credentials automatically. Operations that legitimately
 * accept no auth (e.g. public discovery, OIDC well-known) must declare
 * `security: []` (empty array, opt-out) to make the choice explicit.
 *
 * Standing Order #2 (The Ratchet) — security declarations are forward-only.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

describe('OpenAPI ratchet — security declarations', () => {
  it('every operation has a security declaration (op-level or global)', () => {
    const hasGlobal = Array.isArray(spec.security);
    const offenders: string[] = [];
    for (const [pathKey, methods] of Object.entries<any>(spec.paths || {})) {
      for (const [method, op] of Object.entries<any>(methods)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        const opLevel = Array.isArray(op.security);
        if (!opLevel && !hasGlobal) {
          offenders.push(`${method.toUpperCase()} ${pathKey}`);
        }
      }
    }
    expect(offenders, `Operations missing security declaration:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('declared security schemes all resolve to a defined securityScheme', () => {
    const defined = new Set(Object.keys(spec.components?.securitySchemes || {}));
    const dangling: string[] = [];
    const checkSec = (where: string, sec: any[]) => {
      for (const requirement of sec) {
        for (const schemeName of Object.keys(requirement || {})) {
          if (!defined.has(schemeName)) dangling.push(`${where} references undefined scheme '${schemeName}'`);
        }
      }
    };
    if (Array.isArray(spec.security)) checkSec('global', spec.security);
    for (const [pathKey, methods] of Object.entries<any>(spec.paths || {})) {
      for (const [method, op] of Object.entries<any>(methods)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        if (Array.isArray(op.security)) checkSec(`${method.toUpperCase()} ${pathKey}`, op.security);
      }
    }
    expect(dangling, `Dangling security scheme references:\n  ${dangling.join('\n  ')}`).toEqual([]);
  });
});
