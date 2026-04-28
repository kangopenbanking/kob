// @ts-nocheck
/**
 * Spec-diff guard: compares the current OpenAPI specs against the
 * snapshot in public/docs/baselines/. Fails CI if any public path,
 * operationId, or server base URL is removed or renamed unexpectedly.
 *
 * Additive changes (new paths, new operations) are allowed; removals
 * and renames must be acknowledged by updating the baseline alongside
 * an info.version bump (Standing Order 6 — The Version Gate).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');

const PAIRS = [
  {
    label: 'production',
    current: 'public/openapi.json',
    baseline: 'public/docs/baselines/openapi.previous.json',
    expectedBase: 'https://api.kangopenbanking.com/v1',
  },
  {
    label: 'sandbox',
    current: 'public/openapi-sandbox.json',
    baseline: 'public/docs/baselines/openapi-sandbox.previous.json',
    expectedBase: 'https://api.kangopenbanking.com/v1',
  },
];

function load(rel: string) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8'));
}

function collectOperationIds(spec: any): string[] {
  const ids: string[] = [];
  for (const ops of Object.values<any>(spec.paths || {})) {
    for (const op of Object.values<any>(ops || {})) {
      if (op && typeof op === 'object' && op.operationId) ids.push(op.operationId);
    }
  }
  return ids.sort();
}

describe('OpenAPI spec-diff against previous release baseline', () => {
  for (const { label, current, baseline, expectedBase } of PAIRS) {
    it(`${label} — no public paths removed`, () => {
      const cur = load(current);
      const prev = load(baseline);
      const missing = Object.keys(prev.paths || {}).filter(
        (p) => !(p in (cur.paths || {})),
      );
      expect(missing, `removed paths in ${label}`).toEqual([]);
    });

    it(`${label} — no operationId removed or renamed`, () => {
      const curIds = new Set(collectOperationIds(load(current)));
      const prevIds = collectOperationIds(load(baseline));
      const missing = prevIds.filter((id) => !curIds.has(id));
      expect(missing, `removed operationIds in ${label}`).toEqual([]);
    });

    it(`${label} — server base URL still resolves to ${expectedBase}`, () => {
      const cur = load(current);
      const urls = (cur.servers || []).map((s: any) => s.url);
      expect(urls.some((u: string) => u.startsWith(expectedBase))).toBe(true);
    });
  }
});
