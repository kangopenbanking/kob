import { describe, it, expect } from "vitest";
import specJson from "../../public/openapi.json";

const spec = specJson as any;

describe("OpenAPI Response Structure Validation", () => {
  const paths = spec.paths || {};

  it("all 200 responses have content defined", () => {
    const failures: string[] = [];
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods as any)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        const responses = (op as any).responses;
        if (!responses) continue;
        const ok = responses["200"] || responses["201"];
        if (ok && !ok.content && !ok.$ref) {
          failures.push(`${method.toUpperCase()} ${path} — 200/201 has no content`);
        }
      }
    }
    expect(failures, `Endpoints with empty 200/201:\n${failures.join("\n")}`).toHaveLength(0);
  });

  it("all responses use application/json or application/problem+json", () => {
    const failures: string[] = [];
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods as any)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        const responses = (op as any).responses || {};
        for (const [code, resp] of Object.entries(responses)) {
          const content = (resp as any).content;
          if (!content) continue;
          const types = Object.keys(content);
          const valid = types.every(t =>
            t === "application/json" || t === "application/problem+json" ||
            t === "application/yaml" || t === "text/yaml" ||
            t === "application/octet-stream" || t === "text/plain"
          );
          if (!valid) {
            failures.push(`${method.toUpperCase()} ${path} [${code}] — unexpected content types: ${types.join(", ")}`);
          }
        }
      }
    }
    expect(failures, `Non-standard content types:\n${failures.join("\n")}`).toHaveLength(0);
  });

  it("all error responses (400-499) reference ProblemDetails or have schema", () => {
    const failures: string[] = [];
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods as any)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        const responses = (op as any).responses || {};
        for (const [code, resp] of Object.entries(responses)) {
          const codeNum = parseInt(code, 10);
          if (isNaN(codeNum) || codeNum < 400 || codeNum >= 500) continue;
          const content = (resp as any).content;
          if (!content) continue;
          const jsonContent = content["application/json"] || content["application/problem+json"];
          if (!jsonContent?.schema) {
            failures.push(`${method.toUpperCase()} ${path} [${code}] — 4xx missing schema`);
          }
        }
      }
    }
    expect(failures, `4xx without schema:\n${failures.join("\n")}`).toHaveLength(0);
  });

  it("all schemas in components have required[] arrays", () => {
    const schemas = spec.components?.schemas || {};
    const missing: string[] = [];
    for (const [name, schema] of Object.entries(schemas)) {
      const s = schema as any;
      if (s.type === "object" && s.properties && (!s.required || !Array.isArray(s.required))) {
        // Skip envelopes and oneOf/allOf wrappers
        if (s.allOf || s.oneOf || s.anyOf) continue;
        missing.push(name);
      }
    }
    expect(missing, `Schemas without required[]:\n${missing.join(", ")}`).toHaveLength(0);
  });

  it("StandardResponse and PaginatedResponse schemas exist", () => {
    const schemas = spec.components?.schemas || {};
    expect(schemas).toHaveProperty("StandardResponse");
    expect(schemas).toHaveProperty("PaginatedResponse");
  });

  it("ProblemDetails schema has required error fields", () => {
    const pd = spec.components?.schemas?.ProblemDetails;
    expect(pd).toBeDefined();
    if (pd?.properties) {
      expect(pd.properties).toHaveProperty("type");
      expect(pd.properties).toHaveProperty("title");
      expect(pd.properties).toHaveProperty("status");
    }
  });

  it("all operationIds are unique", () => {
    const ids: string[] = [];
    const dupes: string[] = [];
    for (const [, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods as any)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        const opId = (op as any).operationId;
        if (opId) {
          if (ids.includes(opId)) dupes.push(opId);
          ids.push(opId);
        }
      }
    }
    expect(dupes, `Duplicate operationIds: ${dupes.join(", ")}`).toHaveLength(0);
  });

  it("security schemes are defined", () => {
    const schemes = spec.components?.securitySchemes;
    expect(schemes).toBeDefined();
    expect(schemes).toHaveProperty("bearerAuth");
  });
});
