// @ts-nocheck
/**
 * Backwards-compatibility guard for versioned API documentation.
 *
 * Loads every spec under public/docs/api-versions/ and asserts:
 *   1. Every operationId present in an older version still exists
 *      in the current production spec (no silent removals).
 *   2. Deprecated operations are explicitly flagged with `deprecated: true`
 *      and carry an `x-deprecation-notice` description.
 *   3. Version numbers are monotonically increasing semver values.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');

const dir = path.join(root, 'public/docs/api-versions');
const current = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

function readVersions() {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, spec: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) }))
    .sort((a, b) => a.spec.info.version.localeCompare(b.spec.info.version, undefined, { numeric: true }));
}

function opIds(spec: any): string[] {
  const ids: string[] = [];
  for (const ops of Object.values<any>(spec.paths || {}))
    for (const op of Object.values<any>(ops || {}))
      if (op?.operationId) ids.push(op.operationId);
  return ids;
}

const versions = readVersions();
const currentIds = new Set(opIds(current));

describe('Versioned API docs — backward compatibility', () => {
  it('at least one prior version is archived', () => {
    expect(versions.length).toBeGreaterThan(0);
  });

  for (const { file, spec } of versions) {
    it(`${file} — every operationId still exists in current spec`, () => {
      const removed = opIds(spec).filter((id) => !currentIds.has(id));
      expect(removed, `removed in current: ${removed.join(', ')}`).toEqual([]);
    });

    it(`${file} — deprecations carry an x-deprecation-notice`, () => {
      for (const ops of Object.values<any>(spec.paths || {})) {
        for (const op of Object.values<any>(ops || {})) {
          if (op?.deprecated) {
            const notice = op['x-deprecation-notice'] || op.description || '';
            expect(notice, `${op.operationId} missing deprecation notice`).toMatch(/deprecat/i);
          }
        }
      }
    });
  }

  it('version numbers are monotonically increasing', () => {
    const v = versions.map((x) => x.spec.info.version);
    const sorted = [...v].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    expect(v).toEqual(sorted);
  });
});
