// @ts-nocheck
/**
 * Single-source-of-truth gate for the published API version.
 *
 * Asserts that every public surface that advertises an API version number
 * agrees with `src/config/version.ts` (KOB_API_VERSION). Adding this test
 * prevents the partial-bump regressions that have previously shipped
 * (e.g. spec at 4.32.0 but Postman manifest still on 4.31.0).
 *
 * Justification: Standing Order 6 (The Version Gate) + Order P7 (Changelog).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { KOB_API_VERSION } from "../config/version";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const readJson = (p: string) => JSON.parse(read(p));

describe(`Version consistency — every surface reports v${KOB_API_VERSION}`, () => {
  it("public/openapi.json info.version matches", () => {
    expect(readJson("public/openapi.json").info.version).toBe(KOB_API_VERSION);
  });

  it("public/openapi.yaml advertises matching version", () => {
    expect(read("public/openapi.yaml")).toContain(`version: ${KOB_API_VERSION}`);
  });

  it("public/changelog.json apiVersion matches and has an entry", () => {
    const cl = readJson("public/changelog.json");
    expect(cl.apiVersion).toBe(KOB_API_VERSION);
    expect((cl.entries || []).some((e: any) => e.version === KOB_API_VERSION)).toBe(true);
  });

  it("public/CHANGELOG.md header reports the current version", () => {
    expect(read("public/CHANGELOG.md")).toContain(
      `Current API version: **${KOB_API_VERSION}**`
    );
  });

  it("public/openapi-history/manifest.json current matches and has snapshot entry", () => {
    const m = readJson("public/openapi-history/manifest.json");
    expect(m.current).toBe(KOB_API_VERSION);
    const entry = (m.versions || []).find((v: any) => v.version === KOB_API_VERSION);
    expect(entry, `missing manifest entry for ${KOB_API_VERSION}`).toBeTruthy();
    expect(["snapshot", "changelog_only"]).toContain(entry.type);
    if (entry.type === "snapshot") {
      expect(
        fs.existsSync(path.join(root, "public/openapi-history", entry.file))
      ).toBe(true);
    }
  });

  it("public/postman/manifest.json (if present) matches", () => {
    const p = path.join(root, "public/postman/manifest.json");
    if (!fs.existsSync(p)) return;
    const m = JSON.parse(fs.readFileSync(p, "utf8"));
    expect(m.apiVersion).toBe(KOB_API_VERSION);
    expect(m.current).toBe(KOB_API_VERSION);
  });

  it("docs/governance has a CHANGELOG file for the current version", () => {
    expect(
      fs.existsSync(
        path.join(root, `docs/governance/CHANGELOG-v${KOB_API_VERSION}.md`)
      )
    ).toBe(true);
  });
});
