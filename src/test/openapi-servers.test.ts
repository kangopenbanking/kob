// @ts-nocheck
/**
 * Confirms every OAuth / OIDC / example URL inside the rendered OpenAPI
 * documents uses the branded public gateway (https://api.kangopenbanking.com)
 * so the Swagger "Try it out" panel hits the correct host.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const PUBLIC = 'https://api.kangopenbanking.com';
const FORBIDDEN = 'wdzkzeahdtxlynetndqw.supabase.co';

function load(rel: string) {
  const abs = path.join(root, rel);
  if (rel.endsWith('.json')) return JSON.parse(fs.readFileSync(abs, 'utf-8'));
  return yaml.load(fs.readFileSync(abs, 'utf-8'));
}

const SPECS = [
  'public/openapi.json',
  'public/openapi.yaml',
  'public/openapi-sandbox.json',
  'public/openapi-sandbox.yaml',
];

describe('OpenAPI server + flow URLs use the branded public gateway', () => {
  for (const rel of SPECS) {
    it(`${rel} — servers[] all point at ${PUBLIC}`, () => {
      const spec: any = load(rel);
      expect(spec.servers?.length ?? 0).toBeGreaterThan(0);
      for (const s of spec.servers) {
        expect(s.url, `server url in ${rel}`).toContain(PUBLIC);
        expect(s.url).not.toContain(FORBIDDEN);
      }
    });

    it(`${rel} — OAuth2 flow URLs use the branded gateway`, () => {
      const spec: any = load(rel);
      const schemes = spec.components?.securitySchemes || {};
      for (const [name, scheme] of Object.entries<any>(schemes)) {
        const flows = scheme?.flows || {};
        for (const [flowName, flow] of Object.entries<any>(flows)) {
          for (const key of ['authorizationUrl', 'tokenUrl', 'refreshUrl']) {
            const url = flow?.[key];
            if (typeof url === 'string') {
              expect(url, `${name}.${flowName}.${key} in ${rel}`).toContain(PUBLIC);
              expect(url).not.toContain(FORBIDDEN);
            }
          }
        }
      }
    });

    it(`${rel} — no example field references the internal host`, () => {
      const text = fs.readFileSync(path.join(root, rel), 'utf-8');
      expect(text).not.toContain(FORBIDDEN);
    });
  }
});
