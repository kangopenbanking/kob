/**
 * Reads the canonical API version from src/config/version.ts (SSOT).
 * Used by Netlify build, GitHub Actions, and local pre-deploy checks so the
 * value is never duplicated across config files.
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src/config/version.ts');

export function readExpectedVersion() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`SSOT not found at ${SRC}`);
  }
  const txt = fs.readFileSync(SRC, 'utf-8');
  const m = txt.match(/KOB_API_VERSION\s*=\s*["']([^"']+)["']/);
  if (!m) throw new Error('Could not parse KOB_API_VERSION from src/config/version.ts');
  return m[1];
}

export function resolveExpectedVersion() {
  return process.env.EXPECTED_OPENAPI_VERSION || readExpectedVersion();
}
