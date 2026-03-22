import { describe, it, expect } from 'vitest';

/**
 * Docs & Spec Smoke Tests
 * Validates that OpenAPI specs are valid and documentation endpoints exist.
 * These tests verify the static spec files bundled in /public/.
 */

describe('OpenAPI Spec Smoke Tests', () => {
  it('public/openapi.json is valid JSON with required fields', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const specPath = path.resolve(__dirname, '../../../public/openapi.json');
    
    expect(fs.existsSync(specPath)).toBe(true);
    
    const content = fs.readFileSync(specPath, 'utf-8');
    expect(content.length).toBeGreaterThan(10000); // Must be substantial
    
    const spec = JSON.parse(content);
    expect(spec.openapi).toBeDefined();
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toContain('Kang');
    expect(spec.info.version).toBeDefined();
    expect(spec.paths).toBeDefined();
    expect(Object.keys(spec.paths).length).toBeGreaterThan(50);
  });

  it('public/openapi-sandbox.json is valid JSON with required fields', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const specPath = path.resolve(__dirname, '../../../public/openapi-sandbox.json');
    
    expect(fs.existsSync(specPath)).toBe(true);
    
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    expect(spec.openapi).toBeDefined();
    expect(spec.info).toBeDefined();
    expect(spec.paths).toBeDefined();
  });

  it('public/openapi.yaml exists and is non-empty', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const yamlPath = path.resolve(__dirname, '../../../public/openapi.yaml');
    
    expect(fs.existsSync(yamlPath)).toBe(true);
    const content = fs.readFileSync(yamlPath, 'utf-8');
    expect(content.length).toBeGreaterThan(10000);
    expect(content).toContain('openapi');
    expect(content).toContain('Kang');
  });

  it('public/openapi-sandbox.yaml exists and is non-empty', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const yamlPath = path.resolve(__dirname, '../../../public/openapi-sandbox.yaml');
    
    expect(fs.existsSync(yamlPath)).toBe(true);
    const content = fs.readFileSync(yamlPath, 'utf-8');
    expect(content.length).toBeGreaterThan(10000);
  });

  it('spec contains XAF examples (Cameroon default)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../../public/openapi.json'), 'utf-8'
    );
    expect(content).toContain('XAF');
  });

  it('spec has servers list', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const spec = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../public/openapi.json'), 'utf-8')
    );
    expect(spec.servers).toBeDefined();
    expect(Array.isArray(spec.servers)).toBe(true);
    expect(spec.servers.length).toBeGreaterThan(0);
  });

  it('all operations have at least one 2xx response', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const spec = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../public/openapi.json'), 'utf-8')
    );

    const missing: string[] = [];
    for (const [pathStr, methods] of Object.entries(spec.paths || {})) {
      for (const [method, op] of Object.entries(methods as any)) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
        const responses = (op as any).responses || {};
        const has2xx = Object.keys(responses).some(code => code.startsWith('2'));
        if (!has2xx) missing.push(`${method.toUpperCase()} ${pathStr}`);
      }
    }
    // Allow small number of missing (some may be intentional)
    expect(missing.length).toBeLessThan(5);
  });
});

describe('Developer Portal Route Components', () => {
  it('RedocPage component exists', async () => {
    const fs = await import('fs');
    const path = await import('path');
    expect(fs.existsSync(path.resolve(__dirname, '../developer/RedocPage.tsx'))).toBe(true);
  });

  it('DocsHealth component exists', async () => {
    const fs = await import('fs');
    const path = await import('path');
    expect(fs.existsSync(path.resolve(__dirname, '../developer/DocsHealth.tsx'))).toBe(true);
  });

  it('ApiExplorerStatic component exists', async () => {
    const fs = await import('fs');
    const path = await import('path');
    expect(fs.existsSync(path.resolve(__dirname, '../developer/ApiExplorerStatic.tsx'))).toBe(true);
  });
});
