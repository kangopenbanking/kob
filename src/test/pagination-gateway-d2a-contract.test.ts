// Phase 1B — R1I-d.2A — Contract tests
// Ensures the four ratified d.2A operations expose the required pagination
// surface without regressing preserved invariants.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGETS = [
  "gatewayListSubaccounts",
  "gatewayListBeneficiaries",
  "gatewayListPaymentLinks",
  "gatewayListVirtualAccounts",
];

type OpenApiParameter = {
  name?: string;
  $ref?: string;
  schema?: { default?: unknown; maximum?: unknown } & Record<string, unknown>;
} & Record<string, unknown>;

type OpenApiResponse = {
  headers?: Record<string, unknown>;
} & Record<string, unknown>;

type OpenApiOperation = {
  operationId?: string;
  parameters?: OpenApiParameter[];
  responses?: Record<string, OpenApiResponse>;
} & Record<string, unknown>;

type OpenApiPathItem = Record<string, OpenApiOperation>;

type OpenApiSpec = {
  info: { version: string };
  paths: Record<string, OpenApiPathItem>;
};

type TargetOperation = OpenApiOperation & { __path: string };

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

let spec: OpenApiSpec;
const ops: Record<string, TargetOperation> = {};

beforeAll(() => {
  spec = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/openapi.json"), "utf8"),
  ) as OpenApiSpec;
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [, op] of Object.entries(methods || {})) {
      if (op && typeof op.operationId === "string" && TARGETS.includes(op.operationId)) {
        ops[op.operationId] = { ...op, __path: path };
      }
    }
  }
});

describe("Phase 1B R1I-d.2A · OpenAPI contract", () => {
  it("spec version and operation count are pinned", () => {
    expect(spec.info.version).toBe("4.53.1");
    const count = Object.values(spec.paths).reduce(
      (acc, m) => acc + Object.keys(m).filter((k) => HTTP_METHODS.includes(k)).length,
      0,
    );
    expect(count).toBe(483);
  });

  for (const opId of TARGETS) {
    describe(opId, () => {
      it("exists in the spec", () => expect(ops[opId]).toBeDefined());

      it("preserves operationId (Standing Order 1)", () => {
        expect(ops[opId].operationId).toBe(opId);
      });

      it("declares a ratified limit parameter (default 25, max 100)", () => {
        const params = ops[opId].parameters ?? [];
        const limit = params.find((p) => p.name === "limit");
        expect(limit).toBeDefined();
        expect(limit?.schema?.default).toBe(25);
        expect(limit?.schema?.maximum).toBe(100);
      });

      it("declares a cursor parameter via CursorParam ref", () => {
        const params = ops[opId].parameters ?? [];
        const cursor = params.find(
          (p) => p.$ref === "#/components/parameters/CursorParam" || p.name === "cursor",
        );
        expect(cursor).toBeDefined();
      });

      it("emits ratified X-Pagination-* response headers on 200", () => {
        const headers = ops[opId].responses?.["200"]?.headers ?? {};
        for (const name of [
          "X-Pagination-Mode",
          "X-Pagination-Has-More",
          "X-Pagination-Next-Cursor",
          "X-Pagination-Limit",
        ]) {
          expect(headers[name], `missing ${name}`).toBeDefined();
        }
      });

      it("preserves the standard error response envelope", () => {
        const responses = ops[opId].responses ?? {};
        for (const code of ["400", "401", "429", "500"]) {
          expect(responses[code], `${opId} missing ${code}`).toBeDefined();
        }
      });
    });
  }
});
