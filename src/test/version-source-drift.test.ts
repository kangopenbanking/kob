// @ts-nocheck
/**
 * Source-drift gate (Standing Order 6 — The Version Gate).
 *
 * Scans every developer-portal source file for hardcoded version literals
 * that look like a "current API version" claim. If a file mentions the
 * current API version surface (api_version, "current API", "API Version"),
 * it MUST do so via the `KOB_API_VERSION` SSOT import — never as a string
 * literal — so we cannot ship a doc page whose displayed version drifts
 * from `src/config/version.ts`.
 *
 * Historical "introduced in vX.Y.Z" badges are explicitly allowed: they
 * document when a feature first shipped and intentionally lag behind the
 * current version.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/pages/developer", "src/components/developer"];
const VERSION_LITERAL = /["'`]v?4\.\d+\.\d+["'`]/;
const CURRENT_VERSION_HINTS = [
  /current api version/i,
  /api_version\s*[:=]/i,
  /"API Version"\s*,/,
  /Same as production/i,
];
const ALLOW_HISTORICAL = [
  /introduced in/i,
  /added in/i,
  /since v?\d/i,
  /as of (api )?v\d/i,
  /\bbumped to\b/i,
  /\bChangelog\b/i,
  /\bdeprecated/i,
  /OBIE|FAPI|RFC|ISO|pacs|camt|pain/i,
  // ApiReferenceVersioning lists historical SDK matrix
  /ApiReferenceVersioning/i,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("Version source drift — no hardcoded current-version literals", () => {
  const files = SCAN_DIRS
    .map((d) => path.join(ROOT, d))
    .filter((d) => fs.existsSync(d))
    .flatMap((d) => walk(d));

  it(`scanned ${files.length} developer-portal source files`, () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = path.relative(ROOT, file);
    if (ALLOW_HISTORICAL.some((r) => r.test(rel))) continue;
    const src = fs.readFileSync(file, "utf8");
    const lines = src.split("\n");
    const offenders: string[] = [];
    lines.forEach((line, i) => {
      if (!VERSION_LITERAL.test(line)) return;
      const isCurrentClaim = CURRENT_VERSION_HINTS.some((r) => r.test(line));
      const isHistorical = ALLOW_HISTORICAL.some((r) => r.test(line));
      if (isCurrentClaim && !isHistorical) {
        offenders.push(`L${i + 1}: ${line.trim()}`);
      }
    });
    if (offenders.length) {
      it(`${rel} must use KOB_API_VERSION instead of literal current version`, () => {
        expect(offenders, `Use KOB_API_VERSION from @/config/version:\n${offenders.join("\n")}`).toEqual([]);
      });
    }
  }
});
