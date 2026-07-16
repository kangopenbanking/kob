/// <reference types="node" />
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Guard test: prevents regression of the broken-i18n-key pattern.
 *
 * Pattern `t('some.key' as any)` indicates an i18n key that does NOT exist in
 * the translations table — at runtime it renders the raw key string to the
 * user (e.g. "developer.hero.title.lead"). This test fails CI if any such
 * call is reintroduced in production source code.
 */

const SRC_DIR = path.join(process.cwd(), "src");
const BROKEN_PATTERN = /\bt\(\s*["'][^"']+["']\s+as\s+any\s*\)/;
const ALLOWED_FILES = new Set<string>([
  "src/test/i18n-fr-smoke.test.tsx",
  "src/test/no-broken-i18n-keys.test.ts",
  "src/test/i18n-developer-pages-render.test.tsx",
]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
      walk(full, files);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe("i18n keys", () => {
  // Explicit 30s timeout: this test walks the entire src/ tree synchronously.
  // Under full-suite parallel load the walk exceeds the default 5s vitest
  // timeout on lower-spec CI runners, producing a timing-only flake with no
  // semantic regression. The generous ceiling preserves the assertion
  // strength while eliminating the false negative.
  it("contains no `t('...' as any)` calls in production source", () => {
    const offenders: { file: string; line: number; text: string }[] = [];

    for (const file of walk(SRC_DIR)) {
      const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
      if (ALLOWED_FILES.has(rel)) continue;

      const lines = fs.readFileSync(file, "utf8").split("\n");
      lines.forEach((text, idx) => {
        if (BROKEN_PATTERN.test(text)) {
          offenders.push({ file: rel, line: idx + 1, text: text.trim() });
        }
      });
    }

    if (offenders.length > 0) {
      const report = offenders
        .map((o) => `  ${o.file}:${o.line}\n    ${o.text}`)
        .join("\n");
      throw new Error(
        `Found ${offenders.length} unresolved i18n key(s) — these render as raw key strings to users.\n` +
          `Replace with hardcoded strings or add the key to translations.ts.\n\n${report}`,
      );
    }

    expect(offenders).toHaveLength(0);
  }, 30_000);
});
