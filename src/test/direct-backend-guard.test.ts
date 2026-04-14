import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * DIRECT BACKEND REGRESSION GUARD — PERMANENT (Standing Order 2)
 * 
 * Ensures no legacy custom API domains are reintroduced into active API assets.
 * Tests can only be ADDED, never removed.
 * 
 * Forbidden domains in active API config/spec/docs/examples:
 *   - api.kangopenbanking.com (serves SPA HTML, not edge functions)
 *   - sandbox.kangopenbanking.com (serves SPA HTML, not edge functions)
 *   - mtls.api.kangopenbanking.com (conceptual only)
 */

const FORBIDDEN_DOMAINS = [
  "api.kangopenbanking.com",
  "sandbox.kangopenbanking.com",
  "mtls.api.kangopenbanking.com",
];

/**
 * Files/patterns that are ALLOWED to mention forbidden domains
 * (comments, negation tests, historical audit docs)
 */
const ALLOWED_EXCEPTIONS = [
  "direct-backend-guard.test.ts", // this file
  "api-docs-indexing-audit",       // historical audit doc
  "api-styleguide.md",            // historical architecture note
];

function isException(filePath: string): boolean {
  return ALLOWED_EXCEPTIONS.some((ex) => filePath.includes(ex));
}

function isCommentOrNegation(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.includes(".not.toContain") ||
    trimmed.includes("not.*Contain") ||
    trimmed.includes("# ") ||
    trimmed.includes("NEVER") ||
    trimmed.includes("must NOT") ||
    trimmed.includes("DO NOT")
  );
}

describe("Direct Backend Regression Guard", () => {
  it("should not have forbidden domains in src/config/api.ts active code", async () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../config/api.ts"),
      "utf-8"
    );
    const activeLines = content
      .split("\n")
      .filter((l) => !isCommentOrNegation(l));
    
    for (const domain of FORBIDDEN_DOMAINS) {
      const found = activeLines.find((l) => l.includes(domain));
      expect(found, `Found forbidden domain "${domain}" in api.ts active code`).toBeUndefined();
    }
  });

  it("should not have forbidden domains in OpenAPI spec servers block", async () => {
    const specPath = path.resolve(__dirname, "../../public/openapi.json");
    if (fs.existsSync(specPath)) {
      const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
      const servers = spec.servers || [];
      for (const server of servers) {
        for (const domain of FORBIDDEN_DOMAINS) {
          expect(server.url).not.toContain(domain);
        }
      }
    }
  });

  it("should have direct Supabase backend URL in OpenAPI servers", async () => {
    const specPath = path.resolve(__dirname, "../../public/openapi.json");
    if (fs.existsSync(specPath)) {
      const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
      const servers = spec.servers || [];
      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0].url).toContain("supabase.co/functions/v1");
    }
  });

  it("should not have forbidden domains in SDK default base URLs", () => {
    const sdkFiles = [
      "../../packages/sdk-node/src/client.ts",
      "../../packages/sdk-php/src/KangOpenBanking.php",
      "../../packages/sdk-python/kangopenbanking/client.py",
    ];

    for (const rel of sdkFiles) {
      const filePath = path.resolve(__dirname, rel);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        for (const domain of FORBIDDEN_DOMAINS) {
          expect(
            content.includes(domain),
            `Found forbidden domain "${domain}" in ${rel}`
          ).toBe(false);
        }
      }
    }
  });
});
