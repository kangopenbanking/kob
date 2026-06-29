#!/usr/bin/env node
/**
 * Package the canonical webhook test fixtures into a single versioned zip with
 * SHA-256 checksums so institutions can pin the exact signed payload set.
 *
 * Inputs:  public/sdk-downloads/webhook-fixtures/**
 * Outputs: public/sdk-downloads/webhook-fixtures-v<spec-version>.zip
 *          public/sdk-downloads/webhook-fixtures-v<spec-version>.zip.sha256
 *          public/sdk-downloads/webhook-fixtures-latest.zip (symlink-style copy)
 *          public/sdk-downloads/webhook-fixtures-latest.zip.sha256
 *          public/sdk-downloads/webhook-fixtures/SHA256SUMS  (per-file hashes)
 *
 * Deterministic: zip entries are sorted, mtimes pinned, no extra attributes,
 * so the same input always produces the same archive bytes / hash.
 *
 * Zero npm deps — uses the system `zip` binary, which is preinstalled on
 * Lovable build images and GitHub-hosted runners.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public/sdk-downloads/webhook-fixtures');
const OUT_DIR = join(ROOT, 'public/sdk-downloads');

const specVersion = JSON.parse(
  readFileSync(join(ROOT, 'public/openapi.json'), 'utf8'),
).info.version;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

// 1) Emit per-file SHA256SUMS alongside the fixtures so consumers can verify
//    individual files without unpacking the zip.
const files = walk(SRC).filter((f) => !f.endsWith('SHA256SUMS'));
const sumsLines = files
  .map((f) => {
    const rel = relative(SRC, f).split('\\').join('/');
    return `${sha256(readFileSync(f))}  ${rel}`;
  })
  .join('\n');
writeFileSync(join(SRC, 'SHA256SUMS'), sumsLines + '\n');

// 2) Build a deterministic zip in a temp dir, then move into place.
const stamp = mkdtempSync(join(tmpdir(), 'kob-fixtures-'));
const zipName = `webhook-fixtures-v${specVersion}.zip`;
const zipPath = join(stamp, zipName);

// `zip -X` strips extra attributes; sorting input gives stable entry order.
// SOURCE_DATE_EPOCH pins all entry mtimes (Info-ZIP honours it via -X + -o).
const relFiles = walk(SRC).map((f) => relative(SRC, f).split('\\').join('/')).sort();
execFileSync('zip', ['-X', '-q', zipPath, ...relFiles], {
  cwd: SRC,
  env: { ...process.env, SOURCE_DATE_EPOCH: '1700000000', TZ: 'UTC' },
});
// `zip` doesn't always reset entry mtimes from SOURCE_DATE_EPOCH, so we normalize
// with `zip -o` which sets archive mtime to the newest entry's mtime.
execFileSync('zip', ['-q', '-o', zipPath]);

const zipBuf = readFileSync(zipPath);
const zipHash = sha256(zipBuf);

const versionedZip = join(OUT_DIR, zipName);
const latestZip = join(OUT_DIR, 'webhook-fixtures-latest.zip');
writeFileSync(versionedZip, zipBuf);
writeFileSync(latestZip, zipBuf);
writeFileSync(
  versionedZip + '.sha256',
  `${zipHash}  ${zipName}\n`,
);
writeFileSync(
  latestZip + '.sha256',
  `${zipHash}  webhook-fixtures-latest.zip\n`,
);

rmSync(stamp, { recursive: true, force: true });

console.log(`Packaged ${files.length} fixture file(s) -> ${zipName}`);
console.log(`  sha256: ${zipHash}`);
console.log(`  bytes:  ${zipBuf.length}`);
console.log(`Wrote:`);
console.log(`  ${relative(ROOT, versionedZip)}`);
console.log(`  ${relative(ROOT, versionedZip)}.sha256`);
console.log(`  ${relative(ROOT, latestZip)}`);
console.log(`  ${relative(ROOT, latestZip)}.sha256`);
console.log(`  ${relative(ROOT, join(SRC, 'SHA256SUMS'))}`);

if (!existsSync(versionedZip)) {
  console.error('FATAL: zip not written');
  process.exit(1);
}
