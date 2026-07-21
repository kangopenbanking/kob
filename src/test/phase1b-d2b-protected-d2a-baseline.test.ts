/**
 * Phase 1B — R1I-d.2B — Protected d.2A baseline test.
 *
 * The d.2A slice is CLOSED and protected at:
 *   commit f05c128a67937df4fe0caf7972b78361c258a5fc
 *   verification run 29868371128
 *
 * This test fails closed if the closure commit cannot be resolved, and asserts
 * byte identity for every ratified d.2A artifact plus deep-equality for the
 * four protected OpenAPI operations. It also enforces the I1a scope constraint
 * that neither `gateway-query/index.ts` nor either OpenAPI file has changed.
 */

import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const CLOSURE_COMMIT = "f05c128a67937df4fe0caf7972b78361c258a5fc";
const REPO_ROOT = resolve(__dirname, "../..");

function tryResolveCommit(): { ok: true } | { ok: false; reason: string } {
  const gitAvailable = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (gitAvailable.status !== 0) {
    return { ok: false, reason: "git not available in test environment" };
  }
  const rev = spawnSync("git", ["rev-parse", "--verify", `${CLOSURE_COMMIT}^{commit}`], {
    cwd: REPO_ROOT, encoding: "utf8",
  });
  if (rev.status !== 0) {
    return {
      ok: false,
      reason: `closure commit ${CLOSURE_COMMIT} could not be resolved (shallow clone?)`,
    };
  }
  return { ok: true };
}

function gitShow(path: string): Buffer {
  return execFileSync("git", ["show", `${CLOSURE_COMMIT}:${path}`], {
    cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024,
  });
}

function gitLsTree(path: string): string[] {
  const out = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", CLOSURE_COMMIT, "--", path],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return out.split("\n").filter((l) => l.length > 0);
}

function byteIdentical(path: string): void {
  const closureBytes = gitShow(path);
  const currentBytes = readFileSync(resolve(REPO_ROOT, path));
  expect(
    Buffer.compare(closureBytes, currentBytes),
    `${path} must be byte-identical to closure commit ${CLOSURE_COMMIT}`,
  ).toBe(0);
}

// Extract the d.2A handler block starting from the ratified anchor comment
// through the end of the function definition. This lets I1a insert a d.2B
// block ABOVE the anchor without breaking byte-identity of the d.2A block.
const D2A_ANCHOR = "// ─── Phase 1B — R1I-d.2A";
function extractD2aBlock(source: string): string {
  const idx = source.indexOf(D2A_ANCHOR);
  if (idx < 0) throw new Error(`d.2A anchor '${D2A_ANCHOR}' not found in gateway-query/index.ts`);
  return source.slice(idx);
}

const resolution = tryResolveCommit();

describe("R1I-d.2B — protected d.2A closure-commit resolution", () => {
  it("resolves the closure commit (fails closed otherwise)", () => {
    // Explicitly fail — this test must NEVER silently skip.
    const reason = resolution.ok
      ? ""
      : (resolution as { ok: false; reason: string }).reason;
    expect(resolution.ok, reason).toBe(true);
  });
});

describe.runIf(resolution.ok)("R1I-d.2B — protected d.2A byte identity", () => {
  const files = [
    "supabase/functions/gateway-query/_pagination.ts",
    ".github/workflows/phase1b-r1i-d2a-verification.yml",
  ];
  for (const f of files) {
    it(`byte-identical: ${f}`, () => {
      byteIdentical(f);
    });
  }

  it("byte-identical: every file in scripts/phase1b-d2a/", () => {
    const paths = gitLsTree("scripts/phase1b-d2a");
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) byteIdentical(p);
  });

  it("byte-identical: every d.2A migration + rollback (canonical + concurrent)", () => {
    const pending = gitLsTree("supabase/pending-migrations/phase-1")
      .filter((p) => p.includes("_phase-1b-r1i-d2a-"));
    const ops = gitLsTree("supabase/pending-operations/phase-1")
      .filter((p) => p.includes("_phase-1b-r1i-d2a-"));
    expect(pending.length).toBeGreaterThan(0);
    expect(ops.length).toBeGreaterThan(0);
    for (const p of [...pending, ...ops]) byteIdentical(p);
  });

  it("byte-identical: every d.2A test under src/test/", () => {
    const all = gitLsTree("src/test");
    const d2aTests = all.filter((p) => /phase1b-d2a-|pagination-gateway-d2a-/.test(p));
    expect(d2aTests.length).toBeGreaterThan(0);
    for (const p of d2aTests) byteIdentical(p);
  });
});

describe.runIf(resolution.ok)("R1I-d.2B — protected d.2A handler block in gateway-query/index.ts", () => {
  it("d.2A handler block is byte-identical from the anchor comment onward", () => {
    const rel = "supabase/functions/gateway-query/index.ts";
    if (!existsSync(resolve(REPO_ROOT, rel))) throw new Error(`missing ${rel}`);
    const closureSrc = gitShow(rel).toString("utf8");
    const currentSrc = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    const closureBlock = extractD2aBlock(closureSrc);
    const currentBlock = extractD2aBlock(currentSrc);
    expect(currentBlock).toBe(closureBlock);
  });
});

describe.runIf(resolution.ok)("R1I-d.2B — I1a scope constraint (runtime + OpenAPI unchanged)", () => {
  const untouched = [
    "supabase/functions/gateway-query/index.ts",
    "public/openapi.json",
    "public/openapi.yaml",
  ];
  for (const f of untouched) {
    it(`I1a must not modify: ${f}`, () => {
      byteIdentical(f);
    });
  }
});

describe.runIf(resolution.ok)("R1I-d.2B — protected d.2A OpenAPI operation nodes", () => {
  const D2A_OPERATION_IDS = [
    "gatewayListSubaccounts",
    "gatewayListBeneficiaries",
    "gatewayListPaymentLinks",
    "gatewayListVirtualAccounts",
  ];

  function parsePathsAndOps(spec: unknown): Map<string, unknown> {
    const map = new Map<string, unknown>();
    if (typeof spec !== "object" || spec === null) return map;
    const paths = (spec as { paths?: Record<string, unknown> }).paths;
    if (!paths || typeof paths !== "object") return map;
    for (const [pathKey, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;
      for (const [method, op] of Object.entries(pathItem as Record<string, unknown>)) {
        if (!op || typeof op !== "object") continue;
        const opId = (op as { operationId?: unknown }).operationId;
        if (typeof opId === "string" && D2A_OPERATION_IDS.includes(opId)) {
          map.set(opId, { path: pathKey, method, node: op });
        }
      }
    }
    return map;
  }

  it("each protected d.2A operation node is deeply equal to the closure snapshot", () => {
    const closure = JSON.parse(gitShow("public/openapi.json").toString("utf8")) as unknown;
    const current = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/openapi.json"), "utf8")) as unknown;
    const closureOps = parsePathsAndOps(closure);
    const currentOps = parsePathsAndOps(current);
    for (const id of D2A_OPERATION_IDS) {
      const c = closureOps.get(id);
      const n = currentOps.get(id);
      expect(c, `closure snapshot missing operationId=${id}`).toBeDefined();
      expect(n, `current spec missing operationId=${id}`).toBeDefined();
      expect(n).toEqual(c);
    }
  });

  it("OpenAPI info.version remains 4.53.1", () => {
    const spec = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/openapi.json"), "utf8")) as {
      info?: { version?: string };
    };
    expect(spec.info?.version).toBe("4.53.1");
  });

  it("Total operation count remains 483", () => {
    const spec = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/openapi.json"), "utf8")) as {
      paths?: Record<string, Record<string, unknown>>;
    };
    let count = 0;
    for (const item of Object.values(spec.paths ?? {})) {
      for (const [method, op] of Object.entries(item)) {
        if (["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(method)
            && op && typeof op === "object"
            && typeof (op as { operationId?: unknown }).operationId === "string") {
          count += 1;
        }
      }
    }
    expect(count).toBe(483);
  });
});
