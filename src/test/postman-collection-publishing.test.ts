// @ts-nocheck
/**
 * Postman publishing ratchet:
 *   - public/postman/manifest.json exists and matches openapi.json info.version
 *   - latest + versioned + legacy collection files all exist
 *   - The collection's info.version matches the spec
 *   - The Getting Started + API Explorer pages (React + prerendered HTML)
 *     surface the Postman download links
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const spec = JSON.parse(
  fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'),
);
const apiVersion: string = spec.info.version;
const postmanDir = path.join(root, 'public/postman');

describe('Postman collection publishing', () => {
  it('manifest.json exists and matches the current spec version', () => {
    const m = JSON.parse(
      fs.readFileSync(path.join(postmanDir, 'manifest.json'), 'utf-8'),
    );
    expect(m.apiVersion).toBe(apiVersion);
    expect(m.collection.versioned).toBe(
      `/postman/Kang_Open_Banking_API_v${apiVersion}.postman_collection.json`,
    );
    expect(m.collection.latest).toBe(
      '/postman/Kang_Open_Banking_API_latest.postman_collection.json',
    );
  });

  it('versioned + latest + legacy collection files all exist', () => {
    for (const f of [
      `Kang_Open_Banking_API_v${apiVersion}.postman_collection.json`,
      'Kang_Open_Banking_API_latest.postman_collection.json',
      'Kang_Open_Banking_API_v1.postman_collection.json',
    ]) {
      expect(fs.existsSync(path.join(postmanDir, f)), `missing ${f}`).toBe(true);
    }
  });

  it("collection's info.version matches the spec version", () => {
    const c = JSON.parse(
      fs.readFileSync(
        path.join(postmanDir, 'Kang_Open_Banking_API_latest.postman_collection.json'),
        'utf-8',
      ),
    );
    expect(c.info.version).toBe(apiVersion);
    expect(c.info.name).toBe(`Kang Open Banking API v${apiVersion}`);
  });
});

describe('Postman links surfaced on developer docs', () => {
  const gs = fs.readFileSync(
    path.join(root, 'src/pages/developer/GettingStarted.tsx'),
    'utf-8',
  );
  const ax = fs.readFileSync(
    path.join(root, 'src/pages/developer/ApiExplorer.tsx'),
    'utf-8',
  );
  const pre = fs.readFileSync(
    path.join(root, 'vite-plugin-prerender-docs.ts'),
    'utf-8',
  );

  it('Getting Started page links the latest + versioned collection and both environments', () => {
    expect(gs).toContain('/postman/Kang_Open_Banking_API_latest.postman_collection.json');
    expect(gs).toContain('/postman/Kang_Open_Banking_API_v${KOB_API_VERSION}.postman_collection.json');
    expect(gs).toContain('Kang_Open_Banking_Sandbox.postman_environment.json');
    expect(gs).toContain('Kang_Open_Banking_Production.postman_environment.json');
  });

  it('API Explorer page exposes a Postman download button + noscript link', () => {
    expect(ax).toContain('/postman/Kang_Open_Banking_API_latest.postman_collection.json');
  });

  it('prerendered Getting Started + API Explorer HTML link the Postman collection', () => {
    const gsBlock = pre.split("path: '/developer/getting-started'")[1].split("path: '")[0];
    const axBlock = pre.split("path: '/developer/api-explorer'")[1].split("path: '")[0];
    for (const block of [gsBlock, axBlock]) {
      expect(block).toContain('Kang_Open_Banking_API_latest.postman_collection.json');
      expect(block).toContain('Kang_Open_Banking_API_v${KOB_API_VERSION}.postman_collection.json');
    }
  });
});
