#!/usr/bin/env node
/**
 * Version-sync gate.
 *
 * Asserts that `public/openapi.json` `info.version` matches the SSOT
 * `KOB_API_VERSION` exported from `src/config/version.ts`. Run from the
 * `predeploy` npm script so Netlify fails fast on drift.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const spec = JSON.parse(readFileSync(resolve(root, 'public/openapi.json'), 'utf8'));
const config = readFileSync(resolve(root, 'src/config/version.ts'), 'utf8');

const match = config.match(/KOB_API_VERSION\s*=\s*"([^"]+)"/);
if (!match) {
  console.error('VERSION MISMATCH: KOB_API_VERSION not found in src/config/version.ts');
  process.exit(1);
}
if (spec.info.version !== match[1]) {
  console.error(`VERSION MISMATCH: spec=${spec.info.version} config=${match[1]}`);
  process.exit(1);
}
console.log(`OK Version sync: ${spec.info.version}`);
