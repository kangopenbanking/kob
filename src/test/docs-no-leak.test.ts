// @ts-nocheck — Node imports resolved by vitest
/**
 * CI guard: fail the build if any user-visible documentation, UI page,
 * spec file, or discovery document still references the internal
 * Supabase backend hostname instead of the public branded gateway.
 *
 * This complements worker/scripts/test-no-leak.sh (which probes live URLs)
 * by scanning the SOURCE TREE before deployment.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const FORBIDDEN = 'wdzkzeahdtxlynetndqw.supabase.co';
const PUBLIC_BASE = 'https://api.kangopenbanking.com/v1';

// Files that legitimately reference the internal hostname:
//  - the Supabase JS client (auto-generated)
//  - .env (auto-managed by Lovable Cloud)
//  - test fallbacks that exercise env-var defaults
//  - the admin storage download (direct private file, not API)
const ALLOWLIST = new Set<string>([
  'src/integrations/supabase/client.ts',
  'src/test/gateway-integration.test.ts',
  'src/test/docs-no-leak.test.ts',
  'src/pages/admin/AdminBankDirectory.tsx', // /storage/v1/object link only
  'src/pages/admin/DocsDiagnostics.tsx', // diagnostics page references the string
  '.env',
]);

const SCAN_DIRS = ['src', 'public'];
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
  '.md', '.mdx', '.html', '.txt',
]);

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (TEXT_EXT.has(path.extname(entry.name))) yield full;
  }
}

describe('Frontend documentation has no internal backend URL leaks', () => {
  it('no source/public file references the internal Supabase host (except allowlist)', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      const abs = path.join(root, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of walk(abs)) {
        const rel = path.relative(root, file).replace(/\\/g, '/');
        if (ALLOWLIST.has(rel)) continue;
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes(FORBIDDEN)) {
          // Allow /storage/v1/object/public/ (admin direct file links — not API)
          const lines = content.split('\n');
          const bad = lines.filter(
            (l) => l.includes(FORBIDDEN) && !l.includes('/storage/v1/object/public/'),
          );
          if (bad.length > 0) {
            offenders.push(`${rel}: ${bad.length} bad line(s)`);
          }
        }
      }
    }
    if (offenders.length > 0) {
      throw new Error(
        `Internal backend URL leaks detected — replace with ${PUBLIC_BASE}:\n  - ` +
          offenders.join('\n  - '),
      );
    }
    expect(offenders).toEqual([]);
  });

  it('public OpenAPI specs declare the branded gateway as the production server', () => {
    const j = JSON.parse(
      fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'),
    );
    expect(Array.isArray(j.servers)).toBe(true);
    expect(j.servers.length).toBeGreaterThan(0);
    const urls: string[] = j.servers.map((s: any) => s.url);
    // Production server must be the branded gateway
    expect(urls.some((u) => u.startsWith('https://api.kangopenbanking.com'))).toBe(true);
    // No internal host anywhere in servers
    expect(urls.some((u) => u.includes(FORBIDDEN))).toBe(false);
  });

  it('apis.json discovery document points at the branded gateway', () => {
    const j = JSON.parse(
      fs.readFileSync(path.join(root, 'public/apis.json'), 'utf-8'),
    );
    const text = JSON.stringify(j);
    expect(text.includes(FORBIDDEN)).toBe(false);
    expect(text.includes('api.kangopenbanking.com')).toBe(true);
  });
});
