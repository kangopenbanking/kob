/**
 * Guard: no JSON/YAML asset shipped from the repo may contain the
 * malformed `/v1/v1/` path prefix. This used to leak into the deployed
 * OpenAPI spec, history snapshots, and baselines, producing 389+ broken
 * example URLs in the developer portal.
 *
 * If this test fails, run a global replace of `/v1/v1/` -> `/v1/` and
 * re-run. CI also enforces this via `.github/workflows/no-double-v1.yml`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOTS = ['public', 'docs', 'packages'];
const FILE_RX = /\.(json|ya?ml)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (FILE_RX.test(name)) out.push(full);
  }
  return out;
}

describe('no /v1/v1/ in shipped JSON/YAML assets', () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it('discovers candidate files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('contains zero `/v1/v1/` occurrences', () => {
    const offenders: { file: string; count: number }[] = [];
    for (const f of files) {
      let body = '';
      try { body = readFileSync(f, 'utf8'); } catch { continue; }
      const matches = body.match(/\/v1\/v1\//g);
      if (matches?.length) {
        offenders.push({ file: relative(process.cwd(), f), count: matches.length });
      }
    }
    if (offenders.length) {
      const msg = offenders.map((o) => `  ${o.file}: ${o.count}`).join('\n');
      throw new Error(`Found /v1/v1/ in ${offenders.length} file(s):\n${msg}`);
    }
    expect(offenders).toEqual([]);
  });
});
