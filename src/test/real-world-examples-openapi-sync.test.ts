import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  examples, buildCurl, buildNode, buildPython, buildPhp,
  SANDBOX_BASE, SANDBOX_KEY,
} from "@/pages/developer/realWorldExamplesData";

// Validates every rendered example on /developer/examples/real-world
// against the published OpenAPI spec (public/openapi.json):
//   - HTTP method exists
//   - Spec path key exists
//   - All required body fields are present in the example body
//   - Sample path matches the spec template
//   - Sandbox base URL is the canonical sandbox host
//   - cURL/Node/Python/PHP snippets all reference the same path & method

const specPath = path.resolve(process.cwd(), "public/openapi.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));

describe("Real-World Examples ↔ OpenAPI sync", () => {
  it("uses the canonical sandbox base URL declared in openapi.json", () => {
    const sandboxServer = (spec.servers || []).find((s: { url: string; description?: string }) =>
      /sandbox/i.test(s.description || "") || /sandbox-api/i.test(s.url),
    );
    expect(sandboxServer, "sandbox server present in openapi.servers").toBeTruthy();
    // SANDBOX_BASE should be the host portion (with or without /v1 suffix)
    expect(sandboxServer.url.startsWith(SANDBOX_BASE)).toBe(true);
    expect(SANDBOX_KEY).toMatch(/^sk_test_/);
  });

  for (const ex of examples) {
    describe(`${ex.method} ${ex.specPath}  ·  ${ex.slug}`, () => {
      it("path key exists in openapi.json", () => {
        expect(spec.paths[ex.specPath], `path ${ex.specPath} not in spec`).toBeDefined();
      });

      it("HTTP method exists for the path", () => {
        const op = spec.paths[ex.specPath]?.[ex.method.toLowerCase()];
        expect(op, `${ex.method} ${ex.specPath} missing in spec`).toBeDefined();
      });

      it("body contains every OpenAPI required field", () => {
        const op = spec.paths[ex.specPath]?.[ex.method.toLowerCase()];
        const required: string[] = op?.requestBody?.content?.["application/json"]?.schema?.required || [];
        if (required.length === 0) return;
        expect(ex.body, `example for ${ex.slug} must have a body`).toBeTruthy();
        for (const field of required) {
          expect(ex.body, `${ex.slug}: missing required field '${field}'`).toHaveProperty(field);
        }
      });

      it("declared requiredFields match the spec", () => {
        const op = spec.paths[ex.specPath]?.[ex.method.toLowerCase()];
        const specRequired: string[] = op?.requestBody?.content?.["application/json"]?.schema?.required || [];
        const declared = ex.requiredFields || [];
        // Every declared field must actually be required by the spec
        for (const f of declared) {
          expect(specRequired, `${ex.slug}: declared field '${f}' not required by spec`).toContain(f);
        }
        // Every spec-required field must be declared in the example metadata
        for (const f of specRequired) {
          expect(declared, `${ex.slug}: spec requires '${f}' but example metadata omits it`).toContain(f);
        }
      });

      it("samplePath conforms to the spec template", () => {
        // Strip query string for path comparison
        const sample = ex.samplePath.split("?")[0];
        const template = ex.specPath;
        const templateRegex = new RegExp(
          "^" + template.replace(/\{[^}]+\}/g, "[^/?#]+") + "$",
        );
        expect(templateRegex.test(sample), `${sample} does not match template ${template}`).toBe(true);
      });

      it("sets Idempotency-Key header when the spec requires it", () => {
        const op = spec.paths[ex.specPath]?.[ex.method.toLowerCase()];
        const params = (op?.parameters || []) as Array<{ name?: string; $ref?: string }>;
        const hasIdempotencyParam = params.some(p =>
          p.name === "Idempotency-Key" || (p.$ref || "").endsWith("/IdempotencyKey"),
        );
        if (hasIdempotencyParam) {
          expect(ex.idempotent, `${ex.slug}: spec requires Idempotency-Key but example.idempotent=false`).toBe(true);
          expect(buildCurl(ex)).toMatch(/Idempotency-Key/);
        }
      });

      it("declares FAPI headers when the spec includes XFapi parameters", () => {
        const op = spec.paths[ex.specPath]?.[ex.method.toLowerCase()];
        const params = (op?.parameters || []) as Array<{ name?: string; $ref?: string }>;
        const hasFapi = params.some(p => (p.$ref || "").includes("XFapi"));
        if (hasFapi) {
          expect(ex.fapi, `${ex.slug}: spec uses XFapi headers but example.fapi=false`).toBe(true);
          expect(buildCurl(ex)).toMatch(/x-fapi-interaction-id/);
        }
      });

      it("all four snippets reference the sandbox host, method, and sample path", () => {
        const curl = buildCurl(ex);
        expect(curl).toContain(SANDBOX_BASE + ex.samplePath);
        expect(curl).toContain(ex.method);
        for (const code of [buildNode(ex), buildPython(ex), buildPhp(ex)]) {
          expect(code).toContain(ex.samplePath);
          expect(code).toContain(ex.method);
        }
      });

      it("includes Authorization, Accept and x-api-version headers in cURL", () => {
        const curl = buildCurl(ex);
        expect(curl).toMatch(/Authorization: Bearer sk_test_/);
        expect(curl).toMatch(/Accept: application\/json/);
        expect(curl).toMatch(/x-api-version:/);
      });
    });
  }
});
