// Reusable contract-test fixtures sanity check.
// Confirms the OpenAPI fixture generator can produce non-empty canonical
// payloads for a representative slice of the spec — so other tests that
// rely on it (status, version, future endpoints) get useful inputs.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { loadFixtureRoot } from "./_fixtures/openapi-fixtures";

describe("OpenAPI fixture generator", () => {
  it("loads production spec and lists operations", async () => {
    const spec = JSON.parse(await fs.readFile("public/openapi.json", "utf8"));
    const root = loadFixtureRoot(spec);
    const ops = root.listOperations();
    expect(ops.length).toBeGreaterThan(10);
    // Every op has method + path
    for (const op of ops.slice(0, 20)) {
      expect(op.path.startsWith("/")).toBe(true);
      expect(["GET", "POST", "PUT", "PATCH", "DELETE"]).toContain(op.method);
    }
  });

  it("synthesizes a value for a primitive schema with a pattern", async () => {
    const spec = JSON.parse(await fs.readFile("public/openapi.json", "utf8"));
    const root = loadFixtureRoot(spec);
    const v = root.fixtureForSchema({ type: "string", pattern: "^[0-9]{1,15}$" });
    expect(typeof v).toBe("string");
    expect((v as string).length).toBeGreaterThan(0);
  });

  it("respects required[] on object schemas", async () => {
    const spec = JSON.parse(await fs.readFile("public/openapi.json", "utf8"));
    const root = loadFixtureRoot(spec);
    const out = root.fixtureForSchema({
      type: "object",
      required: ["amount", "currency"],
      properties: {
        amount: { type: "string", pattern: "^[0-9]{1,15}$" },
        currency: { type: "string", enum: ["XAF"] },
        optional_note: { type: "string" },
      },
    }) as Record<string, unknown>;
    expect(out).toHaveProperty("amount");
    expect(out).toHaveProperty("currency");
    expect(out).not.toHaveProperty("optional_note");
  });
});
