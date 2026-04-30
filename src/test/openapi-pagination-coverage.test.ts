// @ts-nocheck — Node imports resolved by vitest
/**
 * CI Ratchet — every list endpoint MUST:
 *   1. Return the canonical `PaginatedResponse` envelope (data + pagination + meta).
 *   2. Declare a `limit` (or `per_page`) query parameter.
 *   3. Declare a cursor-style query parameter (`cursor`, `starting_after`, `page`, or `offset`).
 *
 * Justification:
 *   - Stripe API: pagination uses `limit` + `starting_after`/`ending_before`.
 *   - JSON:API §8: collections must include pagination links/meta.
 *   - Standing Order #2 (Ratchet): once a list endpoint is conformant it cannot regress.
 *
 * Phase 5b additive sweep brought 21 previously-non-conformant endpoints into compliance.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

function refersToPaginated(schema: any): boolean {
  if (!schema) return false;
  if (typeof schema.$ref === 'string' && schema.$ref.includes('PaginatedResponse')) return true;
  if (Array.isArray(schema.allOf)) return schema.allOf.some(refersToPaginated);
  return false;
}
function paramName(p: any): string {
  if (p.$ref) return spec.components?.parameters?.[p.$ref.split('/').pop()]?.name?.toLowerCase() || '';
  return (p.name || '').toLowerCase();
}

const lists: Array<{ key: string; usesPaginated: boolean; hasLimit: boolean; hasCursor: boolean }> = [];
for (const [p, methods] of Object.entries<any>(spec.paths || {})) {
  const op = methods.get;
  if (!op) continue;
  const sch = op.responses?.['200']?.content?.['application/json']?.schema;
  let isList = refersToPaginated(sch);
  if (!isList && sch?.type === 'array') isList = true;
  if (!isList && sch?.properties?.data?.type === 'array') isList = true;
  if (!isList) continue;
  const params = [...(methods.parameters || []), ...(op.parameters || [])];
  const names = params.map(paramName);
  lists.push({
    key: `GET ${p}`,
    usesPaginated: refersToPaginated(sch),
    hasLimit: names.some((n) => n === 'limit' || n === 'per_page'),
    hasCursor: names.some((n) => ['cursor', 'starting_after', 'page', 'offset'].includes(n)),
  });
}

describe('OpenAPI ratchet — pagination contract', () => {
  it('PaginatedResponse component is shaped data + pagination + meta', () => {
    const p = spec.components?.schemas?.PaginatedResponse;
    expect(p).toBeTruthy();
    expect(p.required).toEqual(expect.arrayContaining(['data', 'pagination', 'meta']));
  });

  it('every list endpoint uses the PaginatedResponse envelope', () => {
    const off = lists.filter((l) => !l.usesPaginated).map((l) => l.key);
    expect(off, `Lists not using PaginatedResponse:\n  ${off.join('\n  ')}`).toEqual([]);
  });

  it('every list endpoint declares a limit (or per_page) param', () => {
    const off = lists.filter((l) => !l.hasLimit).map((l) => l.key);
    expect(off, `Lists missing limit/per_page:\n  ${off.join('\n  ')}`).toEqual([]);
  });

  it('every list endpoint declares a cursor-style param', () => {
    const off = lists.filter((l) => !l.hasCursor).map((l) => l.key);
    expect(off, `Lists missing cursor/page/offset:\n  ${off.join('\n  ')}`).toEqual([]);
  });
});
