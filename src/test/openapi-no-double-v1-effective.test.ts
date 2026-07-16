// @ts-nocheck
/**
 * Phase 1 baseline gate — semantic /v1/v1/ guard.
 *
 * The existing `no-double-v1-prefix.test.ts` greps shipped assets for the
 * literal `/v1/v1/` substring. It cannot catch the case where
 * `servers[].url` ends in `/v1` AND every `paths` key starts with `/v1/`,
 * which produces `/v1/v1/*` in SDK-generated code and Swagger "Try it out".
 *
 * This test fails if that combination is reintroduced in any shipped spec.
 * See KANG OPEN BANKING API — PERMANENT ENGINEERING EXECUTION CONTRACT,
 * Phase 1 (Contract Stabilisation).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const SPECS = [
  'public/openapi.json',
  'public/openapi.yaml',
  'public/openapi-sandbox.json',
  'public/openapi-sandbox.yaml',
];

function load(rel: string) {
  const abs = path.join(root, rel);
  const txt = fs.readFileSync(abs, 'utf-8');
  return rel.endsWith('.json') ? JSON.parse(txt) : (yaml.load(txt) as any);
}

describe('OpenAPI — servers[] + paths[] must not combine to /v1/v1/*', () => {
  for (const rel of SPECS) {
    it(`${rel}: no server URL ends with /v<n> when paths start with the same prefix`, () => {
      const spec: any = load(rel);
      const paths = Object.keys(spec.paths || {});
      const versionedPathPrefixes = new Set(
        paths.map((p) => p.match(/^\/(v\d+)\//)?.[1]).filter(Boolean) as string[],
      );
      for (const s of spec.servers || []) {
        const url: string = s.url;
        const tail = url.match(/\/(v\d+)\/?$/)?.[1];
        if (tail && versionedPathPrefixes.has(tail)) {
          throw new Error(
            `Effective /${tail}/${tail}/ duplication: server "${url}" combined with paths starting "/${tail}/" in ${rel}. Strip "/${tail}" from servers[].url.`,
          );
        }
      }
    });
  }
});
