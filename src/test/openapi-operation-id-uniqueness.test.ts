// @ts-nocheck — Node imports resolved by vitest, not app tsconfig
/**
 * CI Ratchet — every operation MUST have a unique, present operationId.
 *
 * Justification: OpenAPI 3.1.0 §4.7.10.2 — operationId is the canonical
 * SDK method name. Duplicates cause silent collisions in generated clients
 * (last-wins overwrites). Missing IDs force generators to invent names from
 * paths, producing unstable APIs across regenerations.
 *
 * Standing Order #1 (The Lock) + #2 (The Ratchet) — operationIds, once set,
 * cannot be renamed or removed without a major version bump.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

describe('OpenAPI ratchet — operationId hygiene', () => {
  const ops: Array<{ key: string; opId: string | undefined }> = [];
  for (const [pathKey, methods] of Object.entries<any>(spec.paths || {})) {
    for (const [method, op] of Object.entries<any>(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      ops.push({ key: `${method.toUpperCase()} ${pathKey}`, opId: op.operationId });
    }
  }

  it('every operation declares an operationId', () => {
    const missing = ops.filter((o) => !o.opId).map((o) => o.key);
    expect(missing, `Operations missing operationId:\n  ${missing.join('\n  ')}`).toEqual([]);
  });

  it('all operationIds are unique', () => {
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const { key, opId } of ops) {
      if (!opId) continue;
      if (seen.has(opId)) {
        dups.push(`${opId} -> ${seen.get(opId)} AND ${key}`);
      } else {
        seen.set(opId, key);
      }
    }
    expect(dups, `Duplicate operationIds:\n  ${dups.join('\n  ')}`).toEqual([]);
  });
});
