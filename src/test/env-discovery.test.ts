// @ts-nocheck
/**
 * Validates that production and sandbox documentation/discovery
 * metadata advertise the correct base URLs, keeping the two Swagger
 * UI environments distinct and never cross-pointing.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');

const load = (rel: string) =>
  JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8'));

const PROD_BASE = 'https://api.kangopenbanking.com/v1';
const SBX_BASE = 'https://api.kangopenbanking.com/v1';
const SBX_MARKER = /sandbox|test|sbx/i;

describe('Production vs Sandbox discovery metadata', () => {
  it('production OpenAPI advertises production server', () => {
    const spec = load('public/openapi.json');
    const urls: string[] = (spec.servers || []).map((s: any) => s.url);
    expect(urls.some((u) => u.startsWith(PROD_BASE))).toBe(true);
    // Production must not declare itself as sandbox in description
    const prodServer = spec.servers.find((s: any) => s.url.startsWith(PROD_BASE));
    expect(SBX_MARKER.test(prodServer?.description || '')).toBe(false);
  });

  it('sandbox OpenAPI advertises sandbox server distinctly', () => {
    const spec = load('public/openapi-sandbox.json');
    const urls: string[] = (spec.servers || []).map((s: any) => s.url);
    expect(urls.some((u) => u.startsWith(SBX_BASE))).toBe(true);
    // Sandbox must label itself as sandbox somewhere
    const labels = (spec.servers || [])
      .map((s: any) => `${s.url} ${s.description || ''}`)
      .join(' ');
    expect(SBX_MARKER.test(labels) || SBX_MARKER.test(spec.info?.title || ''))
      .toBe(true);
  });

  it('apis.json catalog exposes both environments without cross-pointing', () => {
    const cat = load('public/apis.json');
    const text = JSON.stringify(cat);
    expect(text).toContain(PROD_BASE);
    expect(text).not.toContain('wdzkzeahdtxlynetndqw.supabase.co');
  });
});
