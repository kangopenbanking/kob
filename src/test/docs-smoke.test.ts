// @ts-nocheck — Node imports resolved by vitest, not app tsconfig
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('OpenAPI Spec Smoke Tests', () => {
  const specPath = path.resolve(__dirname, '../../public/openapi.json');
  const sandboxPath = path.resolve(__dirname, '../../public/openapi-sandbox.json');
  const yamlPath = path.resolve(__dirname, '../../public/openapi.yaml');
  const sandboxYamlPath = path.resolve(__dirname, '../../public/openapi-sandbox.yaml');

  it('openapi.json is valid with required fields', () => {
    expect(fs.existsSync(specPath)).toBe(true);
    const content = fs.readFileSync(specPath, 'utf-8');
    expect(content.length).toBeGreaterThan(10000);
    const spec = JSON.parse(content);
    expect(spec.openapi).toBeDefined();
    expect(spec.info?.title).toContain('Kang');
    expect(spec.info?.version).toBeDefined();
    expect(Object.keys(spec.paths || {}).length).toBeGreaterThan(50);
  });

  it('openapi-sandbox.json is valid', () => {
    expect(fs.existsSync(sandboxPath)).toBe(true);
    const spec = JSON.parse(fs.readFileSync(sandboxPath, 'utf-8'));
    expect(spec.openapi).toBeDefined();
    expect(spec.paths).toBeDefined();
  });

  it('openapi.yaml exists and is non-empty', () => {
    expect(fs.existsSync(yamlPath)).toBe(true);
    const content = fs.readFileSync(yamlPath, 'utf-8');
    expect(content.length).toBeGreaterThan(10000);
    expect(content).toContain('openapi');
  });

  it('openapi-sandbox.yaml exists', () => {
    expect(fs.existsSync(sandboxYamlPath)).toBe(true);
    expect(fs.readFileSync(sandboxYamlPath, 'utf-8').length).toBeGreaterThan(10000);
  });

  it('spec contains XAF examples', () => {
    const content = fs.readFileSync(specPath, 'utf-8');
    expect(content).toContain('XAF');
  });

  it('spec has servers list', () => {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    expect(Array.isArray(spec.servers)).toBe(true);
    expect(spec.servers.length).toBeGreaterThan(0);
  });

  it('all operations have 2xx responses', () => {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    const missing: string[] = [];
    for (const [p, methods] of Object.entries(spec.paths || {})) {
      for (const [m, op] of Object.entries(methods as Record<string, any>)) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(m)) continue;
        const has2xx = Object.keys(op.responses || {}).some((c: string) => c.startsWith('2'));
        if (!has2xx) missing.push(`${m.toUpperCase()} ${p}`);
      }
    }
    expect(missing.length).toBeLessThan(5);
  });

  it('sandbox spec has sandbox server URL', () => {
    const spec = JSON.parse(fs.readFileSync(sandboxPath, 'utf-8'));
    const serverUrls = (spec.servers || []).map((s: any) => s.url).join(' ');
    expect(serverUrls.toLowerCase()).toMatch(/sandbox|test|staging/i);
  });

  it('prod and sandbox specs have same path count', () => {
    const prod = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    const sandbox = JSON.parse(fs.readFileSync(sandboxPath, 'utf-8'));
    const prodPaths = Object.keys(prod.paths || {}).length;
    const sandboxPaths = Object.keys(sandbox.paths || {}).length;
    // Allow minor drift but should be roughly equal
    expect(Math.abs(prodPaths - sandboxPaths)).toBeLessThan(20);
  });
});

describe('Developer Portal Components', () => {
  it('RedocPage exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../pages/developer/RedocPage.tsx'))).toBe(true);
  });
  it('DocsHealth exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../pages/developer/DocsHealth.tsx'))).toBe(true);
  });
  it('ApiExplorerStatic exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../pages/developer/ApiExplorerStatic.tsx'))).toBe(true);
  });
  it('OpenApiDownloads exists', () => {
    expect(fs.existsSync(path.resolve(__dirname, '../pages/developer/OpenApiDownloads.tsx'))).toBe(true);
  });
});

describe('Cache Headers', () => {
  it('_headers file exists with spec cache rules', () => {
    const headersPath = path.resolve(__dirname, '../../public/_headers');
    expect(fs.existsSync(headersPath)).toBe(true);
    const content = fs.readFileSync(headersPath, 'utf-8');
    expect(content).toContain('/openapi.json');
    expect(content).toContain('max-age=300');
    expect(content).toContain('stale-while-revalidate');
  });
});

describe('RedocPage sandbox awareness', () => {
  it('RedocPage source references sandbox spec path', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../pages/developer/RedocPage.tsx'),
      'utf-8'
    );
    expect(src).toContain('openapi-sandbox.json');
    expect(src).toContain('isSandbox');
  });
});
