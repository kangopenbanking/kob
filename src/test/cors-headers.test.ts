// @ts-nocheck
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

/**
 * Parses a Netlify-style _headers file into { [pathPattern]: { [header]: value } }
 */
function parseHeaders(content: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  let current: string | null = null;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!line.startsWith(' ') && !line.startsWith('\t')) {
      current = line.trim();
      out[current] = {};
    } else if (current) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).trim().toLowerCase();
        const val = line.slice(idx + 1).trim();
        out[current][key] = val;
      }
    }
  }
  return out;
}

const PUBLIC_SPEC_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/openapi-sandbox.json',
  '/openapi-sandbox.yaml',
  '/apis.json',
  '/apis-sandbox.json',
  '/changelog.json',
];

describe('Public spec CORS regression', () => {
  const headersFile = fs.readFileSync(path.join(root, 'public/_headers'), 'utf-8');
  const rules = parseHeaders(headersFile);

  for (const p of PUBLIC_SPEC_PATHS) {
    describe(p, () => {
      it('has a header rule defined', () => {
        expect(rules[p], `Missing rule for ${p} in public/_headers`).toBeDefined();
      });

      it('declares Access-Control-Allow-Origin: *', () => {
        expect(rules[p]?.['access-control-allow-origin']).toBe('*');
      });

      it('declares Access-Control-Allow-Methods including GET', () => {
        const methods = rules[p]?.['access-control-allow-methods'] || '';
        expect(methods.toUpperCase()).toMatch(/\bGET\b/);
      });

      it('declares Access-Control-Allow-Headers', () => {
        expect(rules[p]?.['access-control-allow-headers']).toBeDefined();
      });

      it('declares a Cache-Control directive', () => {
        expect(rules[p]?.['cache-control']).toBeDefined();
      });
    });
  }
});

describe('Public spec files exist and are non-empty', () => {
  for (const p of PUBLIC_SPEC_PATHS) {
    it(`public${p} exists`, () => {
      const fp = path.join(root, 'public', p.replace(/^\//, ''));
      expect(fs.existsSync(fp), `${fp} missing`).toBe(true);
      expect(fs.statSync(fp).size).toBeGreaterThan(50);
    });
  }
});
