/**
 * Phase 1B — R1I-d.2B-I1c-X2-A — Protected-baseline byte-identity test.
 *
 * The X2-A slice is authorised to touch exactly FIVE files:
 *   1. AGENTS.md
 *   2. supabase/functions/merchants-qr-directory/_pagination-qr-directory.ts
 *   3. src/test/pagination-qr-directory-adapter.test.ts
 *   4. src/test/phase1b-x2-protected-baseline.test.ts
 *   5. docs/audits/phase-1/phase-1b-r1i-d2b-i1c-x2-compatibility-decision.md
 *
 * Everything else — the runtime, OpenAPI, SDKs, developer guides, hooks,
 * shared foundation, gateway-query adapters, and protected d.2A / I1a /
 * I1b / I1c artifacts — MUST remain byte-identical to the reviewed base
 * commit `9407e2292590f83ed85770cf93dc43f5eb46c2e8`.
 *
 * This test fails closed if the base commit cannot be resolved.
 */

import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_COMMIT = "9407e2292590f83ed85770cf93dc43f5eb46c2e8";
const REPO_ROOT = resolve(__dirname, "../..");

function baseCommitResolves(): boolean {
  const git = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (git.status !== 0) return false;
  const rev = spawnSync(
    "git",
    ["rev-parse", "--verify", `${BASE_COMMIT}^{commit}`],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return rev.status === 0;
}

function gitShow(path: string): Buffer {
  return execFileSync("git", ["show", `${BASE_COMMIT}:${path}`], {
    cwd: REPO_ROOT,
    maxBuffer: 256 * 1024 * 1024,
  });
}

function readHead(path: string): Buffer {
  return readFileSync(resolve(REPO_ROOT, path));
}

/**
 * Protected files that MUST remain byte-identical to `BASE_COMMIT`.
 * Grouped so an accidental change surfaces with its category context.
 */
const PROTECTED_FILES: readonly { group: string; path: string }[] = [
  // Shared foundation (d.1F closure)
  { group: "shared foundation", path: "supabase/functions/_shared/pagination.ts" },

  // d.2A protected adapter + runtime
  { group: "d.2A adapter",       path: "supabase/functions/gateway-query/_pagination.ts" },
  { group: "d.2B adapter (I1a)", path: "supabase/functions/gateway-query/_pagination-d2b.ts" },
  { group: "gateway-query runtime (I1b)", path: "supabase/functions/gateway-query/index.ts" },

  // QR runtime — X2-A does NOT touch it
  { group: "qr directory runtime", path: "supabase/functions/merchants-qr-directory/index.ts" },

  // OpenAPI (I1c closure)
  { group: "openapi json", path: "public/openapi.json" },
  { group: "openapi yaml", path: "public/openapi.yaml" },

  // Repository-owned SDK QR resources
  { group: "sdk-node qr",   path: "packages/sdk-node/src/qr.ts" },
  { group: "sdk-python qr", path: "packages/sdk-python/kangopenbanking/qr.py" },
  { group: "sdk-php qr",    path: "packages/sdk-php/src/Resources/QRDirectoryResource.php" },

  // Repository-owned consumer hook
  { group: "consumer hook", path: "src/hooks/useMerchantDirectory.ts" },
];

describe("R1I-d.2B-I1c-X2-A — protected baseline", () => {
  it("base commit resolves (fails closed if it cannot)", () => {
    expect(baseCommitResolves(),
      `base commit ${BASE_COMMIT} could not be resolved from ${REPO_ROOT}. ` +
      "The X2-A protected-baseline test refuses to silent-skip.",
    ).toBe(true);
  });

  for (const entry of PROTECTED_FILES) {
    it(`${entry.group} — ${entry.path} is byte-identical to base`, () => {
      if (!baseCommitResolves()) {
        throw new Error(
          `base commit ${BASE_COMMIT} could not be resolved; refusing to skip`,
        );
      }
      const base = gitShow(entry.path);
      const head = readHead(entry.path);
      expect(
        head.equals(base),
        `${entry.path} differs from base commit ${BASE_COMMIT}. ` +
        "X2-A may not modify this file.",
      ).toBe(true);
    });
  }

  it("openapi.json version and operation count are unchanged (invariant sanity)", () => {
    const raw = readHead("public/openapi.json").toString("utf8");
    const parsed = JSON.parse(raw) as {
      info: { version: string };
      paths: Record<string, Record<string, unknown>>;
    };
    expect(parsed.info.version).toBe("4.53.1");
    let opCount = 0;
    const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head", "trace"]);
    for (const path of Object.keys(parsed.paths)) {
      const item = parsed.paths[path];
      for (const method of Object.keys(item)) {
        if (methods.has(method.toLowerCase())) opCount += 1;
      }
    }
    expect(opCount).toBe(483);
  });

  it("X2-A diff vs base is limited to the five authorised paths", () => {
    if (!baseCommitResolves()) {
      throw new Error(
        `base commit ${BASE_COMMIT} could not be resolved; refusing to skip`,
      );
    }
    const out = execFileSync(
      "git",
      ["diff", "--name-only", `${BASE_COMMIT}`, "--", "."],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
    const changed = out.split("\n").filter((l) => l.length > 0).sort();
    const permitted = [
      "AGENTS.md",
      "docs/audits/phase-1/phase-1b-r1i-d2b-i1c-x2-compatibility-decision.md",
      "src/test/pagination-qr-directory-adapter.test.ts",
      "src/test/phase1b-x2-protected-baseline.test.ts",
      "supabase/functions/merchants-qr-directory/_pagination-qr-directory.ts",
    ].sort();
    const unauthorised = changed.filter((p) => !permitted.includes(p));
    expect(
      unauthorised,
      `unauthorised files changed vs base commit ${BASE_COMMIT}: ${unauthorised.join(", ")}`,
    ).toEqual([]);
  });
});
