// Canonical request/response payload generator from the OpenAPI spec.
//
// Used by contract tests to keep example payloads automatically aligned with
// public/openapi.json as the spec evolves. If the spec adds/removes a field,
// every test that calls fixtureForRequest()/fixtureForResponse() updates
// without code changes.
//
// Strategy:
//   - Walk components.schemas with $ref resolution
//   - Prefer schema.example, then schema.default, then synthesize a value
//     from type/enum/pattern/format
//   - Honor required[] strictly; skip optional fields to keep fixtures minimal
//
// Designed for our spec subset only — not a general OpenAPI tool.

type AnySchema = Record<string, unknown>;

export interface FixtureRoot {
  spec: AnySchema;
  resolveRef(ref: string): AnySchema;
  fixtureForSchema(schema: AnySchema): unknown;
  fixtureForRequest(path: string, method: string): unknown;
  fixtureForResponse(path: string, method: string, statusCode?: string): unknown;
  listOperations(): { path: string; method: string; operationId?: string }[];
}

export function loadFixtureRoot(spec: AnySchema): FixtureRoot {
  function resolveRef(ref: string): AnySchema {
    // "#/components/schemas/Charge"
    const parts = ref.replace(/^#\//, "").split("/");
    let cur: any = spec;
    for (const p of parts) cur = cur?.[p];
    if (!cur) throw new Error(`Unresolved $ref: ${ref}`);
    return cur as AnySchema;
  }

  function synthesizeString(s: AnySchema): string {
    if (Array.isArray(s.enum) && s.enum.length) return String(s.enum[0]);
    if (typeof s.example === "string") return s.example;
    if (typeof s.default === "string") return s.default;
    if (s.format === "date-time") return new Date("2026-01-01T00:00:00Z").toISOString();
    if (s.format === "date") return "2026-01-01";
    if (s.format === "uuid") return "00000000-0000-4000-8000-000000000000";
    if (s.format === "email") return "dev@example.com";
    if (s.format === "uri") return "https://example.com";
    if (typeof s.pattern === "string") {
      // Best-effort canonical values for the common patterns we use in the spec.
      if (s.pattern.includes("0-9") && s.pattern.includes("15")) return "1000"; // money amounts
      if (s.pattern === "^chg_[a-zA-Z0-9_]+$") return "chg_test_123";
      if (s.pattern === "^evt_[a-zA-Z0-9_]+$") return "evt_test_123";
      if (s.pattern === "^po_[a-zA-Z0-9_]+$") return "po_test_123";
    }
    return "string";
  }

  function fixtureForSchema(schema: AnySchema): unknown {
    if (!schema) return null;
    if (typeof schema.$ref === "string") return fixtureForSchema(resolveRef(schema.$ref));
    if (Array.isArray((schema as any).oneOf)) return fixtureForSchema((schema as any).oneOf[0]);
    if (Array.isArray((schema as any).anyOf)) return fixtureForSchema((schema as any).anyOf[0]);
    if (Array.isArray((schema as any).allOf)) {
      // Merge object-style allOf
      const merged: AnySchema = { type: "object", properties: {}, required: [] };
      for (const sub of (schema as any).allOf) {
        const resolved = sub.$ref ? resolveRef(sub.$ref) : sub;
        Object.assign((merged.properties as object) ?? {}, (resolved.properties ?? {}) as object);
        if (Array.isArray(resolved.required)) {
          (merged.required as string[]).push(...resolved.required);
        }
      }
      return fixtureForSchema(merged);
    }
    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;

    const t = schema.type as string | undefined;
    if (t === "object" || schema.properties) {
      const out: Record<string, unknown> = {};
      const props = (schema.properties ?? {}) as Record<string, AnySchema>;
      const required = (schema.required ?? []) as string[];
      for (const key of required) {
        if (props[key]) out[key] = fixtureForSchema(props[key]);
      }
      return out;
    }
    if (t === "array") return schema.items ? [fixtureForSchema(schema.items as AnySchema)] : [];
    if (t === "string") return synthesizeString(schema);
    if (t === "integer") return typeof schema.minimum === "number" ? schema.minimum : 1;
    if (t === "number") return 1.0;
    if (t === "boolean") return true;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    return null;
  }

  function operation(path: string, method: string): AnySchema {
    const op = (spec as any).paths?.[path]?.[method.toLowerCase()];
    if (!op) throw new Error(`No operation for ${method.toUpperCase()} ${path}`);
    return op as AnySchema;
  }

  function fixtureForRequest(path: string, method: string): unknown {
    const op = operation(path, method);
    const body = (op as any).requestBody?.content?.["application/json"]?.schema;
    if (!body) return undefined;
    return fixtureForSchema(body);
  }

  function fixtureForResponse(path: string, method: string, statusCode = "200"): unknown {
    const op = operation(path, method);
    const responses = (op as any).responses ?? {};
    const node = responses[statusCode] ?? responses[String(statusCode).charAt(0) + "XX"] ?? responses.default;
    const schema = node?.content?.["application/json"]?.schema;
    if (!schema) return undefined;
    return fixtureForSchema(schema);
  }

  function listOperations() {
    const out: { path: string; method: string; operationId?: string }[] = [];
    const paths = ((spec as any).paths ?? {}) as Record<string, Record<string, AnySchema>>;
    for (const [p, methods] of Object.entries(paths)) {
      for (const [m, op] of Object.entries(methods)) {
        if (["get", "post", "put", "patch", "delete"].includes(m)) {
          out.push({ path: p, method: m.toUpperCase(), operationId: (op as any).operationId });
        }
      }
    }
    return out;
  }

  return { spec, resolveRef, fixtureForSchema, fixtureForRequest, fixtureForResponse, listOperations };
}
