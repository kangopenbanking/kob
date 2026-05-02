// @ts-nocheck — Node imports resolved by vitest
/**
 * CI guard: fail the build if the developer-portal source tree contains
 * regressions that previously broke the live docs site.
 *
 * Forbidden patterns (in any file under the scanned roots):
 *   1. `YOUR_PROJECT`                — placeholder URL never replaced
 *   2. `supabase.co/functions/v1`    — internal backend host leaked into docs
 *   3. visible `<div id="ssr-fallback"` injection                — duplicate
 *      content bug; the prerender plugin must keep ssr-fallback inside
 *      <noscript> only (crawler-only, hydrates away invisibly).
 *
 * Companion to:
 *   - src/test/docs-no-leak.test.ts    (full src/ + public/ scan)
 *   - worker/scripts/test-no-leak.sh   (live URL probe)
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const SCAN_ROOTS = [
  'src/pages/developer',
  'src/components/developer',
  'public/docs',
];
const SCAN_FILES = ['vite-plugin-prerender-docs.ts'];

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx', '.html', '.txt',
  '.yaml', '.yml',
]);

const ALLOWLIST = new Set<string>([
  // This test file itself contains the forbidden strings as literals.
  'src/test/developer-portal-content.test.ts',
]);

function* walk(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (TEXT_EXT.has(path.extname(entry.name))) yield full;
  }
}

function scanned(): string[] {
  const files: string[] = [];
  for (const r of SCAN_ROOTS) {
    for (const f of walk(path.join(root, r))) files.push(f);
  }
  for (const f of SCAN_FILES) {
    const abs = path.join(root, f);
    if (fs.existsSync(abs)) files.push(abs);
  }
  return files;
}

function rel(file: string): string {
  return path.relative(root, file).replace(/\\/g, '/');
}

describe('Developer portal source has no regression patterns', () => {
  it('no developer-portal file contains the YOUR_PROJECT placeholder', () => {
    const offenders: string[] = [];
    for (const file of scanned()) {
      const r = rel(file);
      if (ALLOWLIST.has(r)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('YOUR_PROJECT')) offenders.push(r);
    }
    expect(offenders).toEqual([]);
  });

  it('no developer-portal file contains the internal supabase.co/functions/v1 URL', () => {
    const needle = 'supabase.co/functions/v1';
    const offenders: string[] = [];
    for (const file of scanned()) {
      const r = rel(file);
      if (ALLOWLIST.has(r)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes(needle)) offenders.push(r);
    }
    expect(offenders).toEqual([]);
  });

  it('the prerender plugin must NOT inject a visible <div id="ssr-fallback">', () => {
    // The plugin file is allowed to *mention* ssr-fallback in comments and to
    // wrap fallback content in <noscript>. It must NOT emit the bare
    // `<div id="ssr-fallback"` construct that caused the duplicate-content
    // body bug on /developer.
    const pluginPath = path.join(root, 'vite-plugin-prerender-docs.ts');
    if (!fs.existsSync(pluginPath)) return;
    const content = fs.readFileSync(pluginPath, 'utf-8');
    // Scan line by line; ignore commented lines.
    const lines = content.split('\n');
    const offenders: number[] = [];
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (line.includes('<div id="ssr-fallback"') ||
          line.includes("<div id='ssr-fallback'")) {
        offenders.push(idx + 1);
      }
    });
    expect(offenders).toEqual([]);
  });
});
