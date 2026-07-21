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

function gitLsTreeHead(path: string): string[] {
  const out = execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", "HEAD", "--", path],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  return out.split("\n").filter((l) => l.length > 0);
}

function assertSetEquality(
  namespace: string,
  closurePaths: string[],
  headPaths: string[],
  filter: (p: string) => boolean = () => true,
): void {
  const closureSet = new Set(closurePaths.filter(filter));
  const headSet = new Set(headPaths.filter(filter));
  const added = [...headSet].filter((p) => !closureSet.has(p));
  const removed = [...closureSet].filter((p) => !headSet.has(p));
  expect(
    added,
    `${namespace}: files added or renamed-in vs closure: ${added.join(", ")}`,
  ).toEqual([]);
  expect(
    removed,
    `${namespace}: files deleted or renamed-out vs closure: ${removed.join(", ")}`,
  ).toEqual([]);
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
    const closurePaths = gitLsTree("scripts/phase1b-d2a");
    const headPaths = gitLsTreeHead("scripts/phase1b-d2a");
    expect(closurePaths.length).toBeGreaterThan(0);
    assertSetEquality("scripts/phase1b-d2a", closurePaths, headPaths);
    for (const p of closurePaths) byteIdentical(p);
  });

  it("byte-identical: every d.2A migration + rollback (canonical + concurrent)", () => {
    const filterD2a = (p: string) => p.includes("_phase-1b-r1i-d2a-");
    const closurePending = gitLsTree("supabase/pending-migrations/phase-1").filter(filterD2a);
    const closureOps = gitLsTree("supabase/pending-operations/phase-1").filter(filterD2a);
    const headPending = gitLsTreeHead("supabase/pending-migrations/phase-1").filter(filterD2a);
    const headOps = gitLsTreeHead("supabase/pending-operations/phase-1").filter(filterD2a);
    expect(closurePending.length).toBeGreaterThan(0);
    expect(closureOps.length).toBeGreaterThan(0);
    assertSetEquality("d.2A pending-migrations", closurePending, headPending);
    assertSetEquality("d.2A pending-operations", closureOps, headOps);
    for (const p of [...closurePending, ...closureOps]) byteIdentical(p);
  });

  it("byte-identical: every d.2A test under src/test/", () => {
    const filterD2a = (p: string) => /phase1b-d2a-|pagination-gateway-d2a-/.test(p);
    const closureTests = gitLsTree("src/test").filter(filterD2a);
    const headTests = gitLsTreeHead("src/test").filter(filterD2a);
    expect(closureTests.length).toBeGreaterThan(0);
    assertSetEquality("d.2A tests", closureTests, headTests);
    for (const p of closureTests) byteIdentical(p);
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

// -----------------------------------------------------------------------------
// I1c scope constraint. The expired I1b requirement that both complete OpenAPI
// files remain byte-identical to the d.2A closure has been replaced. I1c is
// authorised to modify only the three d.2B operation nodes in the OpenAPI
// files; every other operation, every d.2A op node, every d.2B runtime/SQL
// artifact, and every reusable component must remain equal to the applicable
// closure baseline. Version 4.53.1 and operation count 483 are pinned.
// -----------------------------------------------------------------------------

const I1A_CLOSURE_COMMIT = "aa8124e5ee03c87acdc3615cf85d78c36855882b";
const I1B_CLOSURE_COMMIT = "1485c5593d5b712043564ee68a7274eacb8f185d";
const D2B_OPERATION_IDS = [
  "gatewayListCustomers",
  "gatewayListPaymentPlans",
  "gatewayListSubscriptions",
] as const;
const D2B_TARGETS: Record<string, { path: string; method: string }> = {
  gatewayListCustomers: { path: "/v1/gateway/customers", method: "get" },
  gatewayListPaymentPlans: { path: "/v1/gateway/payment-plans", method: "get" },
  gatewayListSubscriptions: { path: "/v1/gateway/subscriptions", method: "get" },
};
// Reusable-component allowlist for I1c. PREFER EMPTY. Any name added here must
// carry an inline justification. An unrelated component change fails the test.
const I1C_COMPONENT_ALLOWLIST: ReadonlyArray<{ section: string; name: string; reason: string }> =
  [];

function tryResolveNamed(commit: string): { ok: true } | { ok: false; reason: string } {
  const rev = spawnSync("git", ["rev-parse", "--verify", `${commit}^{commit}`], {
    cwd: REPO_ROOT, encoding: "utf8",
  });
  if (rev.status !== 0) {
    return { ok: false, reason: `commit ${commit} could not be resolved (shallow clone?)` };
  }
  return { ok: true };
}

function gitShowAt(commit: string, path: string): Buffer {
  return execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024,
  });
}

function byteIdenticalAt(commit: string, path: string): void {
  const bytes = gitShowAt(commit, path);
  const current = readFileSync(resolve(REPO_ROOT, path));
  expect(
    Buffer.compare(bytes, current),
    `${path} must be byte-identical to commit ${commit}`,
  ).toBe(0);
}

function parsePathsAndAllOps(spec: unknown): Map<string, { path: string; method: string; node: unknown }> {
  const out = new Map<string, { path: string; method: string; node: unknown }>();
  if (typeof spec !== "object" || spec === null) return out;
  const paths = (spec as { paths?: Record<string, unknown> }).paths;
  if (!paths || typeof paths !== "object") return out;
  const HTTP = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];
  for (const [p, item] of Object.entries(paths)) {
    if (!item || typeof item !== "object") continue;
    for (const [m, op] of Object.entries(item as Record<string, unknown>)) {
      if (!HTTP.includes(m)) continue;
      if (!op || typeof op !== "object") continue;
      const opId = (op as { operationId?: unknown }).operationId;
      if (typeof opId !== "string") continue;
      out.set(opId, { path: p, method: m, node: op });
    }
  }
  return out;
}

const i1aResolution = tryResolveNamed(I1A_CLOSURE_COMMIT);
const i1bResolution = tryResolveNamed(I1B_CLOSURE_COMMIT);

describe("R1I-d.2B-I1c — closure commits resolve (fails closed)", () => {
  it("I1a closure commit resolves", () => {
    const reason = i1aResolution.ok ? "" : (i1aResolution as { reason: string }).reason;
    expect(i1aResolution.ok, reason).toBe(true);
  });
  it("I1b closure commit resolves", () => {
    const reason = i1bResolution.ok ? "" : (i1bResolution as { reason: string }).reason;
    expect(i1bResolution.ok, reason).toBe(true);
  });
});

describe.runIf(i1bResolution.ok)("R1I-d.2B-I1c — protected I1b runtime byte identity", () => {
  it("gateway-query/index.ts is byte-identical to I1b closure commit", () => {
    byteIdenticalAt(I1B_CLOSURE_COMMIT, "supabase/functions/gateway-query/index.ts");
  });

  it("d.2A anchor occurs exactly once in gateway-query/index.ts", () => {
    const rel = "supabase/functions/gateway-query/index.ts";
    const src = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    const occurrences = src.split(D2A_ANCHOR).length - 1;
    expect(occurrences).toBe(1);
  });

  it("no d.2B source appears after the d.2A anchor in gateway-query/index.ts", () => {
    const rel = "supabase/functions/gateway-query/index.ts";
    const src = readFileSync(resolve(REPO_ROOT, rel), "utf8");
    const suffix = extractD2aBlock(src);
    for (const forbidden of [
      "_pagination-d2b",
      "handleD2bList",
      "D2B_ROUTES",
      "d2bCorsHeaders",
      "R1I-d.2B",
    ]) {
      expect(
        suffix.includes(forbidden),
        `d.2B token '${forbidden}' must not appear inside the protected d.2A suffix`,
      ).toBe(false);
    }
  });

  it("d.2B runtime integration test is byte-identical to I1b closure commit", () => {
    byteIdenticalAt(
      I1B_CLOSURE_COMMIT,
      "src/test/pagination-gateway-d2b-runtime-integration.test.ts",
    );
  });
});

describe.runIf(i1aResolution.ok)("R1I-d.2B-I1c — protected I1a foundation byte identity", () => {
  it("_pagination-d2b.ts is byte-identical to I1a closure commit", () => {
    byteIdenticalAt(
      I1A_CLOSURE_COMMIT,
      "supabase/functions/gateway-query/_pagination-d2b.ts",
    );
  });

  it("every d.2B SQL artifact is byte-identical to I1a closure commit", () => {
    const filterD2b = (p: string) => p.includes("_phase-1b-r1i-d2b-");
    const closurePending = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", I1A_CLOSURE_COMMIT, "--", "supabase/pending-migrations/phase-1"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).split("\n").filter((l) => l.length > 0).filter(filterD2b);
    const closureOps = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", I1A_CLOSURE_COMMIT, "--", "supabase/pending-operations/phase-1"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    ).split("\n").filter((l) => l.length > 0).filter(filterD2b);
    expect(closurePending.length).toBeGreaterThan(0);
    expect(closureOps.length).toBeGreaterThan(0);
    for (const p of [...closurePending, ...closureOps]) byteIdenticalAt(I1A_CLOSURE_COMMIT, p);
  });
});

describe.runIf(i1bResolution.ok)("R1I-d.2B-I1c — OpenAPI operation scope (target ops only)", () => {
  const currentJson = () =>
    JSON.parse(readFileSync(resolve(REPO_ROOT, "public/openapi.json"), "utf8")) as unknown;
  const i1bJson = () =>
    JSON.parse(gitShowAt(I1B_CLOSURE_COMMIT, "public/openapi.json").toString("utf8")) as unknown;

  it("target operations remain at their expected path + method", () => {
    const current = parsePathsAndAllOps(currentJson());
    for (const [id, expected] of Object.entries(D2B_TARGETS)) {
      const c = current.get(id);
      expect(c, `missing ${id}`).toBeDefined();
      expect(c!.path).toBe(expected.path);
      expect(c!.method).toBe(expected.method);
    }
  });

  it("every non-d.2B operation node is deeply equal to I1b baseline", () => {
    const currentOps = parsePathsAndAllOps(currentJson());
    const baselineOps = parsePathsAndAllOps(i1bJson());
    expect(currentOps.size).toBe(baselineOps.size);
    for (const [id, base] of baselineOps.entries()) {
      if (D2B_OPERATION_IDS.includes(id as (typeof D2B_OPERATION_IDS)[number])) continue;
      const cur = currentOps.get(id);
      expect(cur, `operation ${id} present in I1b but missing at HEAD`).toBeDefined();
      expect(cur!.path).toBe(base.path);
      expect(cur!.method).toBe(base.method);
      expect(cur!.node, `operation ${id} changed vs I1b`).toEqual(base.node);
    }
  });

  it("reusable components remain equal to I1b baseline (allowlist enforced)", () => {
    const cur = currentJson() as { components?: Record<string, Record<string, unknown>> };
    const base = i1bJson() as { components?: Record<string, Record<string, unknown>> };
    const sections = new Set<string>([
      ...Object.keys(cur.components ?? {}),
      ...Object.keys(base.components ?? {}),
    ]);
    const allowed = new Set(
      I1C_COMPONENT_ALLOWLIST.map((a) => `${a.section}::${a.name}`),
    );
    for (const section of sections) {
      const c = (cur.components ?? {})[section] ?? {};
      const b = (base.components ?? {})[section] ?? {};
      const names = new Set<string>([...Object.keys(c), ...Object.keys(b)]);
      for (const name of names) {
        if (allowed.has(`${section}::${name}`)) continue;
        expect(
          c[name],
          `component ${section}.${name} present in I1b but missing at HEAD`,
        ).toBeDefined();
        expect(
          b[name],
          `component ${section}.${name} added at HEAD without allowlist entry`,
        ).toBeDefined();
        expect(c[name], `component ${section}.${name} changed vs I1b`).toEqual(b[name]);
      }
    }
  });

  it("OpenAPI info.version remains 4.53.1", () => {
    const spec = currentJson() as { info?: { version?: string } };
    expect(spec.info?.version).toBe("4.53.1");
  });

  it("Total operation count remains 483", () => {
    const spec = currentJson() as { paths?: Record<string, Record<string, unknown>> };
    let count = 0;
    for (const item of Object.values(spec.paths ?? {})) {
      for (const [method, op] of Object.entries(item)) {
        if (
          ["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(method) &&
          op && typeof op === "object" &&
          typeof (op as { operationId?: unknown }).operationId === "string"
        ) {
          count += 1;
        }
      }
    }
    expect(count).toBe(483);
  });
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
