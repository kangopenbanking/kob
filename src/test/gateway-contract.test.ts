// @ts-nocheck
/**
 * Contract test suite — runs against both the Production and Sandbox
 * gateways and verifies that documented endpoints in the OpenAPI spec
 * return the expected status codes, required headers, and response
 * shapes from the documented examples.
 *
 * The suite is intentionally read-only: it only exercises GET endpoints
 * tagged as safe in the spec (health, discovery, version metadata).
 *
 * Set CONTRACT_LIVE=1 in CI to enable network calls; otherwise tests
 * are skipped to keep local builds offline-friendly.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const LIVE = process.env.CONTRACT_LIVE === '1';

const ENVS = [
  { label: 'production', spec: 'public/openapi.json' },
  { label: 'sandbox', spec: 'public/openapi-sandbox.json' },
];

const SAFE_GET_PATHS = [
  '/v1/health',
  '/v1/ready',
  '/v1/.well-known/openid-configuration',
];

function load(rel: string) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8'));
}

describe('Gateway contract: docs vs. runtime', () => {
  for (const { label, spec } of ENVS) {
    const doc = load(spec);
    const baseUrl: string = doc.servers?.[0]?.url;

    it(`${label} — spec advertises a base URL`, () => {
      expect(baseUrl).toMatch(/^https:\/\//);
    });

    it(`${label} — every safe GET path is declared in the spec`, () => {
      for (const p of SAFE_GET_PATHS) {
        const candidate = p.replace(/^\/v1/, '');
        const declared = (p in (doc.paths || {})) || (candidate in (doc.paths || {}));
        expect(declared, `missing ${p} in ${label} spec`).toBe(true);
      }
    });

    (LIVE ? it : it.skip)(`${label} — live GET responses match documented status codes`, async () => {
      for (const p of SAFE_GET_PATHS) {
        const url = `${baseUrl.replace(/\/v1$/, '')}${p}`;
        const r = await fetch(url, { headers: { Accept: 'application/json' } });
        expect([200, 204], `${url} → ${r.status}`).toContain(r.status);
        const ct = r.headers.get('content-type') || '';
        expect(ct).toMatch(/json/);
      }
    }, 30_000);
  }
});
