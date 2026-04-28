/**
 * Pagination contract test
 * -------------------------
 * Asserts the OpenAPI spec exposes BOTH cursor (starting_after / ending_before)
 * and legacy offset pagination on the AISP + consents list endpoints, that the
 * documented X-Pagination-* response headers are declared on the 200 schema,
 * and that x-pagination top-level extension matches the per-endpoint contract.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

type Spec = Record<string, any>;

function loadSpec(rel: string): Spec {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "public", rel), "utf-8"));
}

const PAGINATED_PATHS = [
  "/v1/aisp/accounts",
  "/v1/aisp/accounts/{accountId}/transactions",
  "/v1/consents",
];

describe.each(["openapi.json", "openapi-sandbox.json"])("Pagination contract — %s", (file) => {
  let spec: Spec;
  beforeAll(() => { spec = loadSpec(file); });

  it("declares cursor pagination as the documented standard", () => {
    expect(spec["x-pagination"]).toBeTruthy();
    expect(spec["x-pagination"].style).toBe("cursor");
    expect(spec["x-pagination"].parameters?.starting_after).toBeTruthy();
    expect(spec["x-pagination"].parameters?.ending_before).toBeTruthy();
    expect(spec["x-pagination"].legacy?.offset).toMatch(/backwards compatibility/i);
  });

  it.each(PAGINATED_PATHS)("%s exposes both cursor and offset modes", (p) => {
    const op = spec.paths?.[p]?.get;
    expect(op, `${p} GET op missing`).toBeTruthy();
    const names = (op.parameters ?? []).map((x: any) => x.name);
    // Both modes documented
    expect(names).toContain("limit");
    expect(names).toContain("offset");
    expect(names).toContain("starting_after");
    expect(names).toContain("ending_before");
  });

  it.each(PAGINATED_PATHS)("%s declares X-Pagination-* response headers", (p) => {
    const headers = spec.paths?.[p]?.get?.responses?.["200"]?.headers ?? {};
    expect(Object.keys(headers)).toEqual(
      expect.arrayContaining(["X-Pagination-Mode", "X-Pagination-Has-More", "X-Pagination-Next-Cursor"]),
    );
    expect(headers["X-Pagination-Mode"].schema?.enum).toEqual(
      expect.arrayContaining(["cursor", "offset"]),
    );
  });

  it.each(PAGINATED_PATHS)("%s offset parameter is marked as legacy", (p) => {
    const op = spec.paths?.[p]?.get;
    const offset = (op.parameters ?? []).find((x: any) => x.name === "offset");
    expect(offset?.description ?? "").toMatch(/legacy|backwards compatibility|prefer/i);
  });
});
