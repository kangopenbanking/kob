// @ts-nocheck — Node imports resolved by vitest, not app tsconfig
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

function loadJson(rel: string) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf-8'));
}
function loadYaml(rel: string) {
  return yaml.load(fs.readFileSync(path.join(root, rel), 'utf-8')) as any;
}

describe('OpenAPI JSON ↔ YAML parity (production)', () => {
  const j = loadJson('public/openapi.json');
  const y = loadYaml('public/openapi.yaml');

  it('info.version matches', () => {
    expect(j.info.version).toBe(y.info.version);
  });

  it('externalDocs matches and is present', () => {
    expect(j.externalDocs).toBeDefined();
    expect(j.externalDocs).toEqual(y.externalDocs);
  });

  it('paths key set is identical', () => {
    expect(Object.keys(j.paths).sort()).toEqual(Object.keys(y.paths).sort());
  });

  it('component schemas key set is identical', () => {
    expect(Object.keys(j.components.schemas).sort()).toEqual(
      Object.keys(y.components.schemas).sort()
    );
  });

  it('security schemes key set is identical', () => {
    expect(Object.keys(j.components.securitySchemes).sort()).toEqual(
      Object.keys(y.components.securitySchemes).sort()
    );
  });

  it('/healthz is present in both specs', () => {
    expect(j.paths['/healthz']).toBeDefined();
    expect(y.paths['/healthz']).toBeDefined();
  });

  it('tag declarations match in count', () => {
    expect((j.tags || []).length).toBe((y.tags || []).length);
  });
});

describe('OpenAPI JSON ↔ YAML parity (sandbox)', () => {
  const j = loadJson('public/openapi-sandbox.json');
  const y = loadYaml('public/openapi-sandbox.yaml');

  it('sandbox versions match', () => {
    expect(j.info.version).toBe(y.info.version);
  });

  it('sandbox externalDocs matches', () => {
    expect(j.externalDocs).toBeDefined();
    expect(j.externalDocs).toEqual(y.externalDocs);
  });

  it('sandbox path keys identical', () => {
    expect(Object.keys(j.paths).sort()).toEqual(Object.keys(y.paths).sort());
  });

  it('/healthz present in both sandbox specs', () => {
    expect(j.paths['/healthz']).toBeDefined();
    expect(y.paths['/healthz']).toBeDefined();
  });
});
