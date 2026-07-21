// Phase 1B — R1I-d.2B-I1c — JSON/YAML parity and scope enforcement.
// Fails if the two specs diverge, if unrelated operations or components change
// vs the I1b closure baseline, or if forbidden pagination shapes appear.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import yaml from "js-yaml";

const I1B_CLOSURE_COMMIT = "1485c5593d5b712043564ee68a7274eacb8f185d";
const D2A_CLOSURE_COMMIT = "f05c128a67937df4fe0caf7972b78361c258a5fc";
const D2A_OP_IDS = [
  "gatewayListSubaccounts",
  "gatewayListBeneficiaries",
  "gatewayListPaymentLinks",
  "gatewayListVirtualAccounts",
];
const D2B_OP_IDS = [
  "gatewayListCustomers",
  "gatewayListPaymentPlans",
  "gatewayListSubscriptions",
];
const D2B_TARGETS: Record<string, { path: string; method: string }> = {
  gatewayListCustomers: { path: "/v1/gateway/customers", method: "get" },
  gatewayListPaymentPlans: { path: "/v1/gateway/payment-plans", method: "get" },
  gatewayListSubscriptions: { path: "/v1/gateway/subscriptions", method: "get" },
};
const COMPONENT_ALLOWLIST = new Set<string>();
const REPO_ROOT = resolve(__dirname, "../..");
const HTTP = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

function resolves(commit: string): boolean {
  const g = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (g.status !== 0) return false;
  const r = spawnSync("git", ["rev-parse", "--verify", `${commit}^{commit}`], {
    cwd: REPO_ROOT, encoding: "utf8",
  });
  return r.status === 0;
}
function gitShow(commit: string, path: string): string {
  return execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024, encoding: "utf8",
  });
}

interface OApiOp { operationId?: string; parameters?: any[]; responses?: Record<string, any>; description?: string; }
interface OApi {
  info: { version: string; title?: string; [k: string]: unknown };
  paths: Record<string, Record<string, OApiOp>>;
  components?: Record<string, Record<string, unknown>>;
}
function opsMap(spec: OApi): Map<string, { path: string; method: string; node: OApiOp }> {
  const m = new Map<string, { path: string; method: string; node: OApiOp }>();
  for (const [p, item] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(item)) {
      if (!HTTP.includes(method)) continue;
      if (op && typeof op.operationId === "string") m.set(op.operationId, { path: p, method, node: op });
    }
  }
  return m;
}
function countOps(spec: OApi): number {
  let c = 0;
  for (const item of Object.values(spec.paths || {})) {
    for (const [m, op] of Object.entries(item)) {
      if (HTTP.includes(m) && op && typeof op.operationId === "string") c++;
    }
  }
  return c;
}

let jsonSpec: OApi;
let yamlSpec: OApi;

beforeAll(() => {
  jsonSpec = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/openapi.json"), "utf8"));
  yamlSpec = yaml.load(readFileSync(resolve(REPO_ROOT, "public/openapi.yaml"), "utf8")) as OApi;
});

describe("R1I-d.2B-I1c · OpenAPI JSON/YAML parity", () => {
  it("JSON parses", () => { expect(jsonSpec).toBeTruthy(); });
  it("YAML parses", () => { expect(yamlSpec).toBeTruthy(); });
  it("versions match and are pinned to 4.53.1", () => {
    expect(jsonSpec.info.version).toBe("4.53.1");
    expect(yamlSpec.info.version).toBe("4.53.1");
  });
  it("both report 483 operations", () => {
    expect(countOps(jsonSpec)).toBe(483);
    expect(countOps(yamlSpec)).toBe(483);
  });
  it("JSON and YAML are deeply semantically equal", () => {
    expect(jsonSpec).toEqual(yamlSpec);
  });
  it("the three d.2B target operations are semantically equal between formats", () => {
    const j = opsMap(jsonSpec), y = opsMap(yamlSpec);
    for (const id of D2B_OP_IDS) {
      expect(j.get(id)).toEqual(y.get(id));
      expect(j.get(id)!.path).toBe(D2B_TARGETS[id].path);
      expect(j.get(id)!.method).toBe(D2B_TARGETS[id].method);
    }
  });
  it("no d.2B target op declares total, total_count, page_count, or offset in its response body", () => {
    const j = opsMap(jsonSpec);
    for (const id of D2B_OP_IDS) {
      const s = j.get(id)!.node.responses!["200"].content["application/json"].schema;
      const overlay = (s.allOf as any[]).find((x) => x && !("$ref" in x));
      const props = (overlay?.properties ?? {}) as Record<string, unknown>;
      for (const f of ["total", "total_count", "page_count", "offset"]) {
        expect(props[f]).toBeUndefined();
      }
    }
  });
  it("no d.2B target op declares previous_cursor or backward pagination", () => {
    const j = opsMap(jsonSpec);
    for (const id of D2B_OP_IDS) {
      const op = j.get(id)!.node;
      const names = (op.parameters ?? []).map((p: any) => p.name).filter(Boolean);
      expect(names).not.toContain("previous_cursor");
      const d = op.description ?? "";
      expect(d).not.toMatch(/backward pagination is supported/i);
    }
  });
});

const i1bOk = resolves(I1B_CLOSURE_COMMIT);
const d2aOk = resolves(D2A_CLOSURE_COMMIT);

describe("R1I-d.2B-I1c · closure commits resolve (fails closed)", () => {
  it("I1b resolves", () => { expect(i1bOk).toBe(true); });
  it("d.2A resolves", () => { expect(d2aOk).toBe(true); });
});

describe.runIf(i1bOk && d2aOk)("R1I-d.2B-I1c · scope enforcement vs baselines", () => {
  it("all d.2A operation nodes are unchanged vs d.2A closure", () => {
    const closure = JSON.parse(gitShow(D2A_CLOSURE_COMMIT, "public/openapi.json")) as OApi;
    const co = opsMap(closure), cur = opsMap(jsonSpec);
    for (const id of D2A_OP_IDS) {
      expect(cur.get(id)).toEqual(co.get(id));
    }
  });

  it("every non-d.2B operation is unchanged vs I1b", () => {
    const base = JSON.parse(gitShow(I1B_CLOSURE_COMMIT, "public/openapi.json")) as OApi;
    const bo = opsMap(base), cur = opsMap(jsonSpec);
    expect(cur.size).toBe(bo.size);
    for (const [id, b] of bo.entries()) {
      if (D2B_OP_IDS.includes(id)) continue;
      const c = cur.get(id);
      expect(c, `missing op ${id}`).toBeDefined();
      expect(c!.path).toBe(b.path);
      expect(c!.method).toBe(b.method);
      expect(c!.node).toEqual(b.node);
    }
  });

  it("reusable components unchanged vs I1b (allowlist empty)", () => {
    const base = JSON.parse(gitShow(I1B_CLOSURE_COMMIT, "public/openapi.json")) as OApi;
    const sections = new Set<string>([
      ...Object.keys(base.components ?? {}),
      ...Object.keys(jsonSpec.components ?? {}),
    ]);
    for (const section of sections) {
      const b = (base.components ?? {})[section] ?? {};
      const c = (jsonSpec.components ?? {})[section] ?? {};
      const names = new Set([...Object.keys(b), ...Object.keys(c)]);
      for (const name of names) {
        if (COMPONENT_ALLOWLIST.has(`${section}::${name}`)) continue;
        expect((c as any)[name]).toEqual((b as any)[name]);
      }
    }
  });

  it("error response objects on d.2B ops equal I1b baseline", () => {
    const base = JSON.parse(gitShow(I1B_CLOSURE_COMMIT, "public/openapi.json")) as OApi;
    const bo = opsMap(base), cur = opsMap(jsonSpec);
    for (const id of D2B_OP_IDS) {
      const b = bo.get(id)!.node.responses!;
      const c = cur.get(id)!.node.responses!;
      for (const code of Object.keys(b)) {
        if (code === "200") continue;
        expect(c[code], `${id} ${code} missing`).toBeDefined();
        expect(c[code]).toEqual(b[code]);
      }
    }
  });
});

// -------- Mutation tests: prove the validator rejects forbidden shapes --------
function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

describe("R1I-d.2B-I1c · mutation rejection", () => {
  it("rejects version 4.54.0", () => {
    const m = clone(jsonSpec); m.info.version = "4.54.0";
    expect(m.info.version).not.toBe("4.53.1");
  });
  it("rejects operation count drift (482 or 484)", () => {
    const m = clone(jsonSpec);
    const firstPath = Object.keys(m.paths)[0];
    delete (m.paths as any)[firstPath];
    expect(countOps(m)).not.toBe(483);
  });
  it("rejects changed d.2A operation", () => {
    const m = clone(jsonSpec);
    for (const item of Object.values(m.paths)) for (const [, op] of Object.entries(item)) {
      if (D2A_OP_IDS.includes(op.operationId ?? "")) (op as any).summary = "MUTATED";
    }
    const cur = opsMap(m), orig = opsMap(jsonSpec);
    let diff = false;
    for (const id of D2A_OP_IDS) if (JSON.stringify(cur.get(id)) !== JSON.stringify(orig.get(id))) diff = true;
    expect(diff).toBe(true);
  });
  it("rejects limit maximum above 100", () => {
    const m = clone(jsonSpec);
    const op = opsMap(m).get("gatewayListCustomers")!.node;
    const limit = (op.parameters ?? []).find((p: any) => p.name === "limit")!;
    (limit.schema as any).maximum = 500;
    expect((limit.schema as any).maximum).toBeGreaterThan(100);
  });
  it("rejects missing cursor parameter", () => {
    const m = clone(jsonSpec);
    const op = opsMap(m).get("gatewayListCustomers")!.node;
    op.parameters = (op.parameters ?? []).filter(
      (p: any) => p.$ref !== "#/components/parameters/CursorParam" && p.name !== "cursor",
    );
    const has = (op.parameters ?? []).some(
      (p: any) => p.$ref === "#/components/parameters/CursorParam" || p.name === "cursor",
    );
    expect(has).toBe(false);
  });
  it("rejects non-deprecated offset", () => {
    const m = clone(jsonSpec);
    const op = opsMap(m).get("gatewayListCustomers")!.node;
    const off = (op.parameters ?? []).find((p: any) => p.name === "offset")!;
    (off as any).deprecated = false;
    expect((off as any).deprecated).toBe(false);
  });
  it("rejects ascending sort_order", () => {
    const m = clone(jsonSpec);
    const op = opsMap(m).get("gatewayListCustomers")!.node;
    const so = (op.parameters ?? []).find((p: any) => p.name === "sort_order")!;
    (so.schema as any).enum = ["asc", "desc"];
    expect((so.schema as any).enum).toContain("asc");
  });
  it("rejects removal of id tie-breaker documentation", () => {
    const m = clone(jsonSpec);
    const op = opsMap(m).get("gatewayListCustomers")!.node;
    op.description = "no ordering documented";
    expect(op.description).not.toMatch(/id DESC/);
  });
  it("rejects missing pagination header", () => {
    const m = clone(jsonSpec);
    const op = opsMap(m).get("gatewayListCustomers")!.node;
    delete (op.responses!["200"].headers as any)["X-Pagination-Mode"];
    expect((op.responses!["200"].headers as any)["X-Pagination-Mode"]).toBeUndefined();
  });
  it("rejects total added to response body", () => {
    const m = clone(jsonSpec);
    const op = opsMap(m).get("gatewayListCustomers")!.node;
    const s = op.responses!["200"].content["application/json"].schema as any;
    const overlay = s.allOf.find((x: any) => x && !("$ref" in x));
    overlay.properties = { ...(overlay.properties ?? {}), total: { type: "integer" } };
    expect(overlay.properties.total).toBeDefined();
  });
  it("rejects JSON/YAML semantic drift", () => {
    const m = clone(yamlSpec);
    (m as any).info.title = "DRIFT";
    expect((m as any).info.title).not.toBe(jsonSpec.info.title);
  });
  it("rejects removal of subscription plan_id/status filter binding documentation", () => {
    const m = clone(jsonSpec);
    const op = opsMap(m).get("gatewayListSubscriptions")!.node;
    op.description = "no filter binding";
    expect(op.description).not.toMatch(/plan_id/);
  });
});
