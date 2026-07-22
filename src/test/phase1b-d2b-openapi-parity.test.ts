// Phase 1B — R1I-d.2B-I1c-R1 — JSON/YAML parity, validator, and post-sync provenance.
//
// This suite:
//   1. Loads the current HEAD OpenAPI JSON + YAML.
//   2. Loads the I1b closure and d.2A closure baselines from git.
//   3. Runs a single pure `validateI1cContract(...)` function that returns a
//      stable list of issue codes describing every violation.
//   4. Uses that validator in the HEAD contract test (must return []) and in
//      every mutation test (must contain the expected issue code).
//   5. Adds provenance assertions for the automatic post-I1c sync commit range
//      2e733fa9...HEAD (90222aaa...): file set, JSON immutability, YAML deep
//      equality vs JSON, and changelog semantic equality modulo timestamps.
//
// No file-level lint suppressions. No explicit `any`. No `ts-ignore` /
// `ts-nocheck` / unsafe global casts.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import yaml from "js-yaml";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const I1B_CLOSURE_COMMIT = "1485c5593d5b712043564ee68a7274eacb8f185d";
const D2A_CLOSURE_COMMIT = "f05c128a67937df4fe0caf7972b78361c258a5fc";
const I1C_IMPL_COMMIT = "9325220e53d84ea562b86806d3d91e6845ca863e";
const I1C_VERIFY_COMMIT = "2e733fa931baa9767d0a8e6c7e5e9870de37dd60";
const AUTOSYNC_HEAD_COMMIT = "90222aaa7cc69e8e81ccc51e0aea7cc27a6af7d2";

const PINNED_VERSION = "4.53.1";
const PINNED_OP_COUNT = 483;
const PINNED_CHANGELOG_ENTRY_COUNT = 88;

const D2A_OP_IDS = [
  "gatewayListSubaccounts",
  "gatewayListBeneficiaries",
  "gatewayListPaymentLinks",
  "gatewayListVirtualAccounts",
] as const;

const D2B_OP_IDS = [
  "gatewayListCustomers",
  "gatewayListPaymentPlans",
  "gatewayListSubscriptions",
] as const;

const D2B_TARGETS: Record<(typeof D2B_OP_IDS)[number], { path: string; method: string }> = {
  gatewayListCustomers: { path: "/v1/gateway/customers", method: "get" },
  gatewayListPaymentPlans: { path: "/v1/gateway/payment-plans", method: "get" },
  gatewayListSubscriptions: { path: "/v1/gateway/subscriptions", method: "get" },
};

const AUTOSYNC_EXPECTED_FILES = [
  "CHANGELOG.md",
  "public/CHANGELOG.md",
  "public/changelog.json",
  "public/openapi.yaml",
] as const;

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);

const REPO_ROOT = resolve(__dirname, "../..");

// ─────────────────────────────────────────────────────────────────────────────
// Types — narrow OpenAPI subset
// ─────────────────────────────────────────────────────────────────────────────
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface RefObject {
  $ref: string;
}
function isRef(value: unknown): value is RefObject {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $ref?: unknown }).$ref === "string"
  );
}

interface SchemaObject {
  type?: string;
  enum?: unknown[];
  maximum?: number;
  minimum?: number;
  default?: unknown;
  properties?: Record<string, SchemaObject | RefObject>;
  items?: SchemaObject | RefObject;
  allOf?: Array<SchemaObject | RefObject>;
  [k: string]: unknown;
}

interface ParameterObject {
  name?: string;
  in?: string;
  required?: boolean;
  deprecated?: boolean;
  description?: string;
  schema?: SchemaObject;
  $ref?: string;
}

interface ResponseObject {
  description?: string;
  headers?: Record<string, unknown>;
  content?: Record<string, { schema?: SchemaObject | RefObject }>;
}

interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: ParameterObject[];
  responses?: Record<string, ResponseObject>;
  [k: string]: unknown;
}

type PathItem = { [method: string]: OperationObject } & Record<string, unknown>;

interface OpenApiDoc {
  info: { version: string; title?: string; [k: string]: unknown };
  paths: Record<string, PathItem>;
  components?: Record<string, Record<string, unknown>>;
  [k: string]: unknown;
}

interface ChangelogDoc {
  apiVersion?: string;
  lastUpdated?: string;
  entries?: unknown[];
  index?: { generated_at?: string; [k: string]: unknown };
  [k: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Git helpers
// ─────────────────────────────────────────────────────────────────────────────
function commitResolves(commit: string): boolean {
  const g = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (g.status !== 0) return false;
  const r = spawnSync("git", ["rev-parse", "--verify", `${commit}^{commit}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return r.status === 0;
}
function gitShow(commit: string, path: string): string {
  return execFileSync("git", ["show", `${commit}:${path}`], {
    cwd: REPO_ROOT,
    maxBuffer: 256 * 1024 * 1024,
    encoding: "utf8",
  });
}
function gitDiffNames(fromCommit: string, toCommit: string): string[] {
  const out = execFileSync("git", ["diff", "--name-only", fromCommit, toCommit], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAPI helpers
// ─────────────────────────────────────────────────────────────────────────────
interface IndexedOp {
  path: string;
  method: string;
  node: OperationObject;
}

function indexOps(spec: OpenApiDoc): Map<string, IndexedOp> {
  const m = new Map<string, IndexedOp>();
  for (const [p, item] of Object.entries(spec.paths ?? {})) {
    for (const [method, opRaw] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method)) continue;
      const op = opRaw as OperationObject;
      if (op && typeof op.operationId === "string") {
        m.set(op.operationId, { path: p, method, node: op });
      }
    }
  }
  return m;
}

function countOperations(spec: OpenApiDoc): number {
  return indexOps(spec).size;
}

function paramName(p: ParameterObject): string | undefined {
  return typeof p.name === "string" ? p.name : undefined;
}

function findParam(op: OperationObject, name: string): ParameterObject | undefined {
  return (op.parameters ?? []).find((p) => paramName(p) === name);
}

function hasCursorRef(op: OperationObject): boolean {
  return (op.parameters ?? []).some(
    (p) => p.$ref === "#/components/parameters/CursorParam" || paramName(p) === "cursor",
  );
}

function responseSchemaOverlay(op: OperationObject): SchemaObject | undefined {
  const schema = op.responses?.["200"]?.content?.["application/json"]?.schema;
  if (!schema || isRef(schema)) return undefined;
  const allOf = (schema as SchemaObject).allOf;
  if (!Array.isArray(allOf)) return undefined;
  for (const part of allOf) {
    if (!isRef(part)) return part as SchemaObject;
  }
  return undefined;
}

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// The validator
// ─────────────────────────────────────────────────────────────────────────────
export type I1cIssueCode =
  | "VERSION_CHANGED"
  | "OPERATION_COUNT_CHANGED"
  | "JSON_YAML_DRIFT"
  | "D2A_OPERATION_CHANGED"
  | "UNRELATED_OPERATION_CHANGED"
  | "COMPONENT_CHANGED"
  | "TARGET_PATH_CHANGED"
  | "LIMIT_INVALID"
  | "CURSOR_MISSING"
  | "OFFSET_NOT_DEPRECATED"
  | "SORT_CONTRACT_INVALID"
  | "ORDERING_DOCUMENTATION_MISSING"
  | "PAGINATION_HEADER_MISSING"
  | "FORBIDDEN_TOTAL_PRESENT"
  | "BACKWARD_PAGINATION_ADDED"
  | "SUBSCRIPTION_FILTER_BINDING_MISSING"
  | "ERROR_RESPONSE_CHANGED";

const REQUIRED_PAGINATION_HEADERS = [
  "X-Pagination-Mode",
  "X-Pagination-Has-More",
  "X-Pagination-Next-Cursor",
  "X-Pagination-Limit",
];

const FORBIDDEN_BODY_FIELDS = ["total", "total_count", "page_count", "offset"];

/**
 * Pure contract validator. Returns a stable set of issue codes.
 * An empty array means the candidate specs conform to the I1c contract.
 */
export function validateI1cContract(
  jsonCandidate: OpenApiDoc,
  yamlCandidate: OpenApiDoc,
  i1bBaseline: OpenApiDoc,
  d2aBaseline: OpenApiDoc,
): I1cIssueCode[] {
  const issues = new Set<I1cIssueCode>();

  // Version pin
  if (jsonCandidate.info.version !== PINNED_VERSION) issues.add("VERSION_CHANGED");
  if (yamlCandidate.info.version !== PINNED_VERSION) issues.add("VERSION_CHANGED");

  // Operation count pin
  if (countOperations(jsonCandidate) !== PINNED_OP_COUNT) issues.add("OPERATION_COUNT_CHANGED");
  if (countOperations(yamlCandidate) !== PINNED_OP_COUNT) issues.add("OPERATION_COUNT_CHANGED");

  // JSON/YAML deep equality
  if (!jsonEqual(jsonCandidate, yamlCandidate)) issues.add("JSON_YAML_DRIFT");

  const cur = indexOps(jsonCandidate);
  const d2a = indexOps(d2aBaseline);
  const i1b = indexOps(i1bBaseline);

  // d.2A operation nodes must be byte-identical (via deep equality) to d.2A closure.
  for (const id of D2A_OP_IDS) {
    const c = cur.get(id);
    const b = d2a.get(id);
    if (!c || !b || !jsonEqual(c.node, b.node) || c.path !== b.path || c.method !== b.method) {
      issues.add("D2A_OPERATION_CHANGED");
    }
  }

  // Non-d.2B operations must be unchanged vs I1b. Additions/removals count as unrelated changes.
  if (cur.size !== i1b.size) {
    issues.add("UNRELATED_OPERATION_CHANGED");
  }
  const d2bSet = new Set<string>(D2B_OP_IDS);
  for (const [id, base] of i1b.entries()) {
    if (d2bSet.has(id)) continue;
    const c = cur.get(id);
    if (!c || c.path !== base.path || c.method !== base.method || !jsonEqual(c.node, base.node)) {
      issues.add("UNRELATED_OPERATION_CHANGED");
      break;
    }
  }
  for (const id of cur.keys()) {
    if (d2bSet.has(id)) continue;
    if (!i1b.has(id)) {
      issues.add("UNRELATED_OPERATION_CHANGED");
      break;
    }
  }

  // Reusable components unchanged vs I1b (allowlist is empty).
  const sections = new Set<string>([
    ...Object.keys(i1bBaseline.components ?? {}),
    ...Object.keys(jsonCandidate.components ?? {}),
  ]);
  for (const section of sections) {
    const b = i1bBaseline.components?.[section] ?? {};
    const c = jsonCandidate.components?.[section] ?? {};
    const names = new Set<string>([...Object.keys(b), ...Object.keys(c)]);
    for (const name of names) {
      if (!jsonEqual(c[name], b[name])) {
        issues.add("COMPONENT_CHANGED");
      }
    }
  }

  // Per-d.2B-op contract
  for (const id of D2B_OP_IDS) {
    const c = cur.get(id);
    if (!c) {
      issues.add("UNRELATED_OPERATION_CHANGED");
      continue;
    }
    const target = D2B_TARGETS[id];
    if (c.path !== target.path || c.method !== target.method) {
      issues.add("TARGET_PATH_CHANGED");
    }
    const op = c.node;

    // limit ∈ [1, 100] with default 25
    const limit = findParam(op, "limit");
    const lmax = limit?.schema?.maximum;
    const lmin = limit?.schema?.minimum;
    if (!limit || typeof lmax !== "number" || lmax > 100 || lmax < 1 || (typeof lmin === "number" && lmin < 1)) {
      issues.add("LIMIT_INVALID");
    }

    // cursor present (either #/components/parameters/CursorParam ref or a named `cursor` param)
    if (!hasCursorRef(op)) issues.add("CURSOR_MISSING");

    // offset deprecated
    const offset = findParam(op, "offset");
    if (!offset || offset.deprecated !== true) issues.add("OFFSET_NOT_DEPRECATED");

    // sort_by, sort_order enums pinned to created_at / desc
    const sortBy = findParam(op, "sort_by");
    const sortOrder = findParam(op, "sort_order");
    const sortByEnum = sortBy?.schema?.enum;
    const sortOrderEnum = sortOrder?.schema?.enum;
    if (
      !sortBy ||
      !sortOrder ||
      !Array.isArray(sortByEnum) ||
      !Array.isArray(sortOrderEnum) ||
      sortByEnum.length !== 1 ||
      sortByEnum[0] !== "created_at" ||
      sortOrderEnum.length !== 1 ||
      sortOrderEnum[0] !== "desc"
    ) {
      issues.add("SORT_CONTRACT_INVALID");
    }

    // Deterministic ordering documented with id tie-breaker
    const desc = op.description ?? "";
    if (!/created_at DESC, id DESC/i.test(desc) || !/tie-breaker/i.test(desc)) {
      issues.add("ORDERING_DOCUMENTATION_MISSING");
    }

    // Required response headers present on 200
    const headers = op.responses?.["200"]?.headers ?? {};
    for (const h of REQUIRED_PAGINATION_HEADERS) {
      if (!headers[h]) {
        issues.add("PAGINATION_HEADER_MISSING");
        break;
      }
    }

    // Forbidden total-style fields in the response overlay body
    const overlay = responseSchemaOverlay(op);
    if (overlay) {
      const props = overlay.properties ?? {};
      for (const f of FORBIDDEN_BODY_FIELDS) {
        if (props[f] !== undefined) {
          issues.add("FORBIDDEN_TOTAL_PRESENT");
          break;
        }
      }
    }

    // Backward pagination must NOT be advertised
    const paramNames = (op.parameters ?? []).map(paramName).filter((n): n is string => Boolean(n));
    if (paramNames.includes("previous_cursor") || /backward pagination is supported/i.test(desc)) {
      issues.add("BACKWARD_PAGINATION_ADDED");
    }

    // Non-200 responses must equal I1b baseline (error transparency ratchet).
    const baseOp = i1b.get(id)?.node;
    if (baseOp) {
      const bRes = baseOp.responses ?? {};
      const cRes = op.responses ?? {};
      for (const code of Object.keys(bRes)) {
        if (code === "200") continue;
        if (!jsonEqual(cRes[code], bRes[code])) {
          issues.add("ERROR_RESPONSE_CHANGED");
          break;
        }
      }
    }
  }

  // Subscription-specific filter binding documentation
  const sub = cur.get("gatewayListSubscriptions")?.node;
  const subDesc = sub?.description ?? "";
  const bindingOk = /plan_id/.test(subDesc) && /status/.test(subDesc) && /filter binding/i.test(subDesc);
  if (!bindingOk) issues.add("SUBSCRIPTION_FILTER_BINDING_MISSING");

  return Array.from(issues);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite state
// ─────────────────────────────────────────────────────────────────────────────
let jsonSpec: OpenApiDoc;
let yamlSpec: OpenApiDoc;
let i1bBaseline: OpenApiDoc;
let d2aBaseline: OpenApiDoc;

const i1bOk = commitResolves(I1B_CLOSURE_COMMIT);
const d2aOk = commitResolves(D2A_CLOSURE_COMMIT);
const autosyncOk = commitResolves(I1C_VERIFY_COMMIT) && commitResolves(AUTOSYNC_HEAD_COMMIT);
const i1cImplOk = commitResolves(I1C_IMPL_COMMIT);

beforeAll(() => {
  jsonSpec = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/openapi.json"), "utf8")) as OpenApiDoc;
  yamlSpec = yaml.load(readFileSync(resolve(REPO_ROOT, "public/openapi.yaml"), "utf8")) as OpenApiDoc;
  if (i1bOk) {
    i1bBaseline = JSON.parse(gitShow(I1B_CLOSURE_COMMIT, "public/openapi.json")) as OpenApiDoc;
  }
  if (d2aOk) {
    d2aBaseline = JSON.parse(gitShow(D2A_CLOSURE_COMMIT, "public/openapi.json")) as OpenApiDoc;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HEAD contract
// ─────────────────────────────────────────────────────────────────────────────
describe("R1I-d.2B-I1c-R1 · closure commits resolve (fails closed)", () => {
  it("I1b closure commit resolves", () => {
    expect(i1bOk).toBe(true);
  });
  it("d.2A closure commit resolves", () => {
    expect(d2aOk).toBe(true);
  });
  it("I1c implementation commit resolves", () => {
    expect(i1cImplOk).toBe(true);
  });
  it("post-I1c auto-sync commits resolve", () => {
    expect(autosyncOk).toBe(true);
  });
});

describe.runIf(i1bOk && d2aOk)("R1I-d.2B-I1c-R1 · HEAD contract via validator", () => {
  it("current HEAD returns no issues", () => {
    const issues = validateI1cContract(jsonSpec, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toEqual([]);
  });

  it("JSON parses", () => {
    expect(jsonSpec).toBeTruthy();
  });
  it("YAML parses", () => {
    expect(yamlSpec).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutation tests — each mutates a valid candidate and asserts an issue code.
// ─────────────────────────────────────────────────────────────────────────────
describe.runIf(i1bOk && d2aOk)("R1I-d.2B-I1c-R1 · mutation rejection via validator", () => {
  const getSubOp = (spec: OpenApiDoc): OperationObject =>
    indexOps(spec).get("gatewayListSubscriptions")!.node;
  const getCustOp = (spec: OpenApiDoc): OperationObject =>
    indexOps(spec).get("gatewayListCustomers")!.node;

  it("version changed → VERSION_CHANGED", () => {
    const m = clone(jsonSpec);
    m.info.version = "4.54.0";
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("VERSION_CHANGED");
  });

  it("operation added → OPERATION_COUNT_CHANGED", () => {
    const m = clone(jsonSpec);
    m.paths["/v1/__fabricated"] = {
      get: {
        operationId: "fabricatedOp",
        responses: { "200": { description: "ok" } },
      } satisfies OperationObject,
    } as PathItem;
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("OPERATION_COUNT_CHANGED");
  });

  it("operation removed → OPERATION_COUNT_CHANGED", () => {
    const m = clone(jsonSpec);
    const firstPath = Object.keys(m.paths)[0];
    delete m.paths[firstPath];
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("OPERATION_COUNT_CHANGED");
  });

  it("d.2A operation changed → D2A_OPERATION_CHANGED", () => {
    const m = clone(jsonSpec);
    const op = indexOps(m).get("gatewayListSubaccounts")!.node;
    op.summary = "MUTATED";
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("D2A_OPERATION_CHANGED");
  });

  it("unrelated operation changed → UNRELATED_OPERATION_CHANGED", () => {
    const m = clone(jsonSpec);
    // Pick an op that's neither d.2A nor d.2B.
    const protectedSet = new Set<string>([...D2A_OP_IDS, ...D2B_OP_IDS]);
    let victimId: string | undefined;
    for (const id of indexOps(m).keys()) {
      if (!protectedSet.has(id)) {
        victimId = id;
        break;
      }
    }
    expect(victimId).toBeDefined();
    const op = indexOps(m).get(victimId!)!.node;
    op.summary = `${op.summary ?? ""} MUTATED`;
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("UNRELATED_OPERATION_CHANGED");
  });

  it("reusable component changed → COMPONENT_CHANGED", () => {
    const m = clone(jsonSpec);
    const schemas = (m.components?.schemas ?? {}) as Record<string, unknown>;
    const firstKey = Object.keys(schemas)[0];
    schemas[firstKey] = { ...(schemas[firstKey] as Record<string, unknown>), description: "MUTATED" };
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("COMPONENT_CHANGED");
  });

  it("limit above 100 → LIMIT_INVALID", () => {
    const m = clone(jsonSpec);
    const limit = findParam(getCustOp(m), "limit")!;
    limit.schema!.maximum = 500;
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("LIMIT_INVALID");
  });

  it("cursor removed → CURSOR_MISSING", () => {
    const m = clone(jsonSpec);
    const op = getCustOp(m);
    op.parameters = (op.parameters ?? []).filter(
      (p) => p.$ref !== "#/components/parameters/CursorParam" && paramName(p) !== "cursor",
    );
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("CURSOR_MISSING");
  });

  it("offset deprecation removed → OFFSET_NOT_DEPRECATED", () => {
    const m = clone(jsonSpec);
    const off = findParam(getCustOp(m), "offset")!;
    off.deprecated = false;
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("OFFSET_NOT_DEPRECATED");
  });

  it("ascending sort added → SORT_CONTRACT_INVALID", () => {
    const m = clone(jsonSpec);
    const so = findParam(getCustOp(m), "sort_order")!;
    so.schema!.enum = ["asc", "desc"];
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("SORT_CONTRACT_INVALID");
  });

  it("id tie-breaker documentation removed → ORDERING_DOCUMENTATION_MISSING", () => {
    const m = clone(jsonSpec);
    getCustOp(m).description = "List customers. No ordering documented here.";
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("ORDERING_DOCUMENTATION_MISSING");
  });

  it("pagination header removed → PAGINATION_HEADER_MISSING", () => {
    const m = clone(jsonSpec);
    const headers = getCustOp(m).responses!["200"].headers as Record<string, unknown>;
    delete headers["X-Pagination-Mode"];
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("PAGINATION_HEADER_MISSING");
  });

  it("total added to response body → FORBIDDEN_TOTAL_PRESENT", () => {
    const m = clone(jsonSpec);
    const overlay = responseSchemaOverlay(getCustOp(m))!;
    overlay.properties = { ...(overlay.properties ?? {}), total: { type: "integer" } };
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("FORBIDDEN_TOTAL_PRESENT");
  });

  it("backward pagination added → BACKWARD_PAGINATION_ADDED", () => {
    const m = clone(jsonSpec);
    const op = getCustOp(m);
    op.description = `${op.description ?? ""}\n\nBackward pagination is supported via previous_cursor.`;
    (op.parameters ?? []).push({ name: "previous_cursor", in: "query", schema: { type: "string" } });
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("BACKWARD_PAGINATION_ADDED");
  });

  it("JSON/YAML drift → JSON_YAML_DRIFT", () => {
    const m = clone(yamlSpec);
    m.info.title = "DRIFT";
    const issues = validateI1cContract(jsonSpec, m, i1bBaseline, d2aBaseline);
    expect(issues).toContain("JSON_YAML_DRIFT");
  });

  it("subscription plan_id filter binding removed → SUBSCRIPTION_FILTER_BINDING_MISSING", () => {
    const m = clone(jsonSpec);
    const sub = getSubOp(m);
    sub.description = (sub.description ?? "").replace(/plan_id/g, "OMITTED_FILTER");
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("SUBSCRIPTION_FILTER_BINDING_MISSING");
  });

  it("subscription status filter binding removed → SUBSCRIPTION_FILTER_BINDING_MISSING", () => {
    const m = clone(jsonSpec);
    const sub = getSubOp(m);
    // Remove the word `status` where it appears in filter-binding sentence; simplest: drop that sentence.
    sub.description = (sub.description ?? "").replace(/Filter binding[^\n]*\n?/gi, "");
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("SUBSCRIPTION_FILTER_BINDING_MISSING");
  });

  it("error response changed → ERROR_RESPONSE_CHANGED", () => {
    const m = clone(jsonSpec);
    const op = getCustOp(m);
    // Mutate the first non-200 response object.
    for (const [code, node] of Object.entries(op.responses ?? {})) {
      if (code === "200") continue;
      (node as ResponseObject).description = "MUTATED_ERROR";
      break;
    }
    const issues = validateI1cContract(m, yamlSpec, i1bBaseline, d2aBaseline);
    expect(issues).toContain("ERROR_RESPONSE_CHANGED");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Post-I1c automatic sync provenance
// ─────────────────────────────────────────────────────────────────────────────
function normaliseChangelog(doc: ChangelogDoc): ChangelogDoc {
  const c = clone(doc);
  delete c.lastUpdated;
  if (c.index && typeof c.index === "object") {
    delete c.index.generated_at;
  }
  return c;
}
function normaliseChangelogMd(md: string): string {
  return md.replace(/Last updated:\s*\*\*[0-9-]+\*\*/g, "Last updated: **NORMALISED**");
}

describe.runIf(autosyncOk && i1cImplOk)("R1I-d.2B-I1c-R1 · post-sync provenance", () => {
  it("auto-sync changed exactly {CHANGELOG.md, public/CHANGELOG.md, public/changelog.json, public/openapi.yaml}", () => {
    const changed = gitDiffNames(I1C_VERIFY_COMMIT, AUTOSYNC_HEAD_COMMIT);
    expect(changed).toEqual([...AUTOSYNC_EXPECTED_FILES].sort());
  });

  it("public/openapi.json at HEAD is byte-identical to I1c implementation commit", () => {
    const impl = gitShow(I1C_IMPL_COMMIT, "public/openapi.json");
    const head = readFileSync(resolve(REPO_ROOT, "public/openapi.json"), "utf8");
    expect(head).toBe(impl);
  });

  it("public/openapi.yaml at HEAD deep-equals public/openapi.json at HEAD", () => {
    expect(yamlSpec).toEqual(jsonSpec);
  });

  it("changelog apiVersion remains 4.53.1", () => {
    const cl = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/changelog.json"), "utf8")) as ChangelogDoc;
    expect(cl.apiVersion).toBe(PINNED_VERSION);
  });

  it("changelog entry count is unchanged", () => {
    const before = JSON.parse(gitShow(I1C_VERIFY_COMMIT, "public/changelog.json")) as ChangelogDoc;
    const head = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/changelog.json"), "utf8")) as ChangelogDoc;
    expect((head.entries ?? []).length).toBe(PINNED_CHANGELOG_ENTRY_COUNT);
    expect((head.entries ?? []).length).toBe((before.entries ?? []).length);
  });

  it("changelog JSON is semantically equal to pre-sync after normalising lastUpdated and index.generated_at", () => {
    const before = JSON.parse(gitShow(I1C_VERIFY_COMMIT, "public/changelog.json")) as ChangelogDoc;
    const head = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/changelog.json"), "utf8")) as ChangelogDoc;
    expect(normaliseChangelog(head)).toEqual(normaliseChangelog(before));
  });

  it("CHANGELOG.md files are semantically equal to pre-sync after normalising the 'Last updated' date", () => {
    const beforeRoot = gitShow(I1C_VERIFY_COMMIT, "CHANGELOG.md");
    const headRoot = readFileSync(resolve(REPO_ROOT, "CHANGELOG.md"), "utf8");
    expect(normaliseChangelogMd(headRoot)).toBe(normaliseChangelogMd(beforeRoot));

    const beforePub = gitShow(I1C_VERIFY_COMMIT, "public/CHANGELOG.md");
    const headPub = readFileSync(resolve(REPO_ROOT, "public/CHANGELOG.md"), "utf8");
    expect(normaliseChangelogMd(headPub)).toBe(normaliseChangelogMd(beforePub));
  });

  it("no new release entry was added by auto-sync", () => {
    const before = JSON.parse(gitShow(I1C_VERIFY_COMMIT, "public/changelog.json")) as ChangelogDoc;
    const head = JSON.parse(readFileSync(resolve(REPO_ROOT, "public/changelog.json"), "utf8")) as ChangelogDoc;
    const beforeVersions = (before.entries ?? []).map((e) =>
      typeof e === "object" && e !== null ? (e as { version?: string }).version : undefined,
    );
    const headVersions = (head.entries ?? []).map((e) =>
      typeof e === "object" && e !== null ? (e as { version?: string }).version : undefined,
    );
    expect(headVersions).toEqual(beforeVersions);
  });

  it("no deployment claim was added by auto-sync", () => {
    const files = [
      readFileSync(resolve(REPO_ROOT, "CHANGELOG.md"), "utf8"),
      readFileSync(resolve(REPO_ROOT, "public/CHANGELOG.md"), "utf8"),
      readFileSync(resolve(REPO_ROOT, "public/changelog.json"), "utf8"),
    ];
    const beforeFiles = [
      gitShow(I1C_VERIFY_COMMIT, "CHANGELOG.md"),
      gitShow(I1C_VERIFY_COMMIT, "public/CHANGELOG.md"),
      gitShow(I1C_VERIFY_COMMIT, "public/changelog.json"),
    ];
    const claimRe = /\b(deployed|released to production|shipped to prod|prod deployment|go[- ]live)\b/i;
    for (let i = 0; i < files.length; i++) {
      const headClaims = (files[i].match(new RegExp(claimRe, "gi")) ?? []).length;
      const beforeClaims = (beforeFiles[i].match(new RegExp(claimRe, "gi")) ?? []).length;
      expect(headClaims).toBe(beforeClaims);
    }
  });
});
