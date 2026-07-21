// Phase 1B — R1I-d.2B-I1c — OpenAPI contract tests for the three d.2B list
// operations. Enforces §2 (Standing Order 2 — Ratchet) and §14 requirements.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
  {
    id: "gatewayListCustomers",
    path: "/v1/gateway/customers",
    method: "get",
    filterBinding: ["sort_by", "sort_order"],
  },
  {
    id: "gatewayListPaymentPlans",
    path: "/v1/gateway/payment-plans",
    method: "get",
    filterBinding: ["sort_by", "sort_order"],
  },
  {
    id: "gatewayListSubscriptions",
    path: "/v1/gateway/subscriptions",
    method: "get",
    filterBinding: ["plan_id", "status", "sort_by", "sort_order"],
    filterBoundSubscription: true,
  },
] as const;

type AnyRec = Record<string, unknown>;
type Param = AnyRec & { name?: string; $ref?: string; schema?: AnyRec; deprecated?: boolean };
type Op = AnyRec & {
  operationId?: string;
  description?: string;
  parameters?: Param[];
  responses?: Record<string, AnyRec>;
};

let spec: {
  info: { version: string };
  paths: Record<string, Record<string, Op>>;
  components?: { parameters?: Record<string, Param>; schemas?: Record<string, unknown> };
};
const ops: Record<string, Op & { __path: string; __method: string }> = {};

const HTTP = ["get", "post", "put", "patch", "delete", "head", "options", "trace"];

beforeAll(() => {
  spec = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/openapi.json"), "utf8"),
  );
  for (const [p, item] of Object.entries(spec.paths || {})) {
    for (const [m, op] of Object.entries(item)) {
      if (op && typeof op.operationId === "string" && TARGETS.some((t) => t.id === op.operationId)) {
        ops[op.operationId] = { ...(op as Op), __path: p, __method: m };
      }
    }
  }
});

function paramByName(op: Op, name: string): Param | undefined {
  return (op.parameters ?? []).find((p) => p.name === name);
}
function resolveRef(ref: string): Param | undefined {
  const parts = ref.replace(/^#\//, "").split("/");
  let cur: unknown = spec;
  for (const p of parts) cur = (cur as AnyRec)[p];
  return cur as Param | undefined;
}
function hasCursorParam(op: Op): boolean {
  return (op.parameters ?? []).some((p) => {
    if (p.$ref === "#/components/parameters/CursorParam") return true;
    if (p.name === "cursor") return true;
    if (typeof p.$ref === "string") {
      const r = resolveRef(p.$ref);
      if (r?.name === "cursor") return true;
    }
    return false;
  });
}

describe("Phase 1B R1I-d.2B-I1c · OpenAPI contract", () => {
  it("spec version and operation count are pinned", () => {
    expect(spec.info.version).toBe("4.53.1");
    let count = 0;
    for (const item of Object.values(spec.paths)) {
      for (const [m, op] of Object.entries(item)) {
        if (HTTP.includes(m) && op && typeof op.operationId === "string") count++;
      }
    }
    expect(count).toBe(483);
  });

  for (const t of TARGETS) {
    describe(t.id, () => {
      it("exists at expected GET path", () => {
        const op = ops[t.id];
        expect(op).toBeDefined();
        expect(op.operationId).toBe(t.id);
        expect(op.__method).toBe("get");
        expect(op.__path).toBe(t.path);
      });

      it("declares a ratified limit parameter (min 1, default 25, max 100)", () => {
        const p = paramByName(ops[t.id], "limit");
        expect(p, "limit param missing").toBeDefined();
        expect(p!.schema!.minimum).toBe(1);
        expect(p!.schema!.default).toBe(25);
        expect(p!.schema!.maximum).toBe(100);
      });

      it("declares canonical cursor parameter", () => {
        expect(hasCursorParam(ops[t.id])).toBe(true);
      });

      it("declares offset as deprecated", () => {
        const p = paramByName(ops[t.id], "offset");
        expect(p, "offset param missing").toBeDefined();
        expect(p!.deprecated).toBe(true);
      });

      it("declares starting_after as deprecated (inline)", () => {
        const p = paramByName(ops[t.id], "starting_after");
        expect(p, "starting_after param missing").toBeDefined();
        expect(p!.deprecated).toBe(true);
      });

      it("declares ending_before as deprecated (inline)", () => {
        const p = paramByName(ops[t.id], "ending_before");
        expect(p, "ending_before param missing").toBeDefined();
        expect(p!.deprecated).toBe(true);
      });

      it("sort_by is enum [created_at] and defaults to created_at", () => {
        const p = paramByName(ops[t.id], "sort_by");
        expect(p, "sort_by missing").toBeDefined();
        expect(p!.schema!.enum).toEqual(["created_at"]);
        expect(p!.schema!.default).toBe("created_at");
      });

      it("sort_order is enum [desc] and defaults to desc", () => {
        const p = paramByName(ops[t.id], "sort_order");
        expect(p, "sort_order missing").toBeDefined();
        expect(p!.schema!.enum).toEqual(["desc"]);
        expect(p!.schema!.default).toBe("desc");
      });

      it("description documents 1800s cursor lifetime and (created_at DESC, id DESC) ordering", () => {
        const d = ops[t.id].description ?? "";
        expect(d).toMatch(/1800/);
        expect(d).toMatch(/created_at DESC/);
        expect(d).toMatch(/id DESC/);
        expect(d).toMatch(/tie-breaker/i);
      });

      it("description states default 25 / max 100 / no exact total / cursor preferred / offset deprecated", () => {
        const d = ops[t.id].description ?? "";
        expect(d).toMatch(/25/);
        expect(d).toMatch(/100/);
        expect(d).toMatch(/no exact total/i);
        expect(d).toMatch(/preferred/i);
        expect(d).toMatch(/deprecated/i);
      });

      it("description documents envelope and four pagination headers", () => {
        const d = ops[t.id].description ?? "";
        expect(d).toMatch(/\{data, pagination, meta\}/);
        for (const h of [
          "X-Pagination-Mode",
          "X-Pagination-Has-More",
          "X-Pagination-Next-Cursor",
          "X-Pagination-Limit",
        ]) expect(d.includes(h), `description missing ${h}`).toBe(true);
      });

      it("200 response uses PaginatedResponse via allOf", () => {
        const schema = ops[t.id].responses!["200"]!.content!["application/json"]!.schema as AnyRec;
        expect(Array.isArray(schema.allOf)).toBe(true);
        const refs = (schema.allOf as AnyRec[])
          .map((s) => s.$ref)
          .filter((r) => typeof r === "string");
        expect(refs).toContain("#/components/schemas/PaginatedResponse");
      });

      it("PaginatedResponse envelope requires data, pagination, meta and does not introduce total*", () => {
        const paginated = spec.components!.schemas!["PaginatedResponse"] as AnyRec;
        expect(paginated.required).toEqual(
          expect.arrayContaining(["data", "pagination", "meta"]),
        );
        const schema = ops[t.id].responses!["200"]!.content!["application/json"]!.schema as AnyRec;
        const overlay = (schema.allOf as AnyRec[]).find(
          (s) => s && typeof s === "object" && !("$ref" in s),
        ) as AnyRec | undefined;
        const props = (overlay?.properties ?? {}) as AnyRec;
        for (const forbidden of ["total", "total_count", "page_count", "offset"]) {
          expect(props[forbidden], `${t.id} response must not declare ${forbidden}`).toBeUndefined();
        }
      });

      it("200 declares all four X-Pagination-* headers with correct schemas", () => {
        const headers = ops[t.id].responses!["200"]!.headers as Record<string, AnyRec>;
        const mode = headers["X-Pagination-Mode"].schema as AnyRec;
        expect(mode.enum).toEqual(["cursor", "hybrid"]);
        const more = headers["X-Pagination-Has-More"].schema as AnyRec;
        expect(more.type).toBe("boolean");
        const next = headers["X-Pagination-Next-Cursor"].schema as AnyRec;
        expect(next.type).toBe("string");
        expect(headers["X-Pagination-Next-Cursor"].description).toMatch(/empty/i);
        const limit = headers["X-Pagination-Limit"].schema as AnyRec;
        expect(limit.type).toBe("integer");
        expect(limit.minimum).toBe(1);
        expect(limit.maximum).toBe(100);
      });

      it("non-200 responses are preserved (400/401/403/404/409/429/500)", () => {
        const r = ops[t.id].responses ?? {};
        for (const code of ["400", "401", "403", "404", "409", "429", "500"]) {
          expect(r[code], `${t.id} missing ${code}`).toBeDefined();
        }
      });

      if (t.filterBoundSubscription) {
        it("gatewayListSubscriptions preserves plan_id and status", () => {
          expect(paramByName(ops[t.id], "plan_id")).toBeDefined();
          expect(paramByName(ops[t.id], "status")).toBeDefined();
        });
        it("gatewayListSubscriptions documents plan_id/status cursor binding and filter-mismatch", () => {
          const d = ops[t.id].description ?? "";
          expect(d).toMatch(/plan_id/);
          expect(d).toMatch(/status/);
          expect(d).toMatch(/PAGINATION_CURSOR_FILTER_MISMATCH/);
        });
      }
    });
  }
});
