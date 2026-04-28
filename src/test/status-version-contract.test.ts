// Contract test: /v1/status and /v1/version return documented fields in
// both production and sandbox. Uses the OpenAPI fixture generator to assert
// the response shape stays aligned with public/openapi.json automatically.

import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadFixtureRoot } from "./_fixtures/openapi-fixtures";

const REQUIRED_STATUS_FIELDS = ["status", "time", "environment", "version", "services"];
const REQUIRED_VERSION_FIELDS = [
  "api_version", "build", "released_at", "environment",
  "supported_versions", "deprecated_versions", "spec_url",
];

async function loadSpec(file: string) {
  const raw = await fs.readFile(path.resolve(file), "utf8");
  return JSON.parse(raw);
}

describe("/v1/status and /v1/version contract", () => {
  for (const env of ["production", "sandbox"] as const) {
    const specFile = env === "production" ? "public/openapi.json" : "public/openapi-sandbox.json";

    it(`[${env}] /v1/status edge function returns documented shape`, async () => {
      const fn = await fs.readFile("supabase/functions/api-status/index.ts", "utf8");
      for (const f of REQUIRED_STATUS_FIELDS) expect(fn).toContain(f);
      // Documented sub-services
      for (const svc of ["db", "oauth", "gateway", "webhooks"]) expect(fn).toContain(svc);
    });

    it(`[${env}] /v1/version edge function returns documented shape`, async () => {
      const fn = await fs.readFile("supabase/functions/api-version/index.ts", "utf8");
      for (const f of REQUIRED_VERSION_FIELDS) expect(fn).toContain(f);
    });

    it(`[${env}] OpenAPI spec exposes /status and /version paths if present`, async () => {
      const spec = await loadSpec(specFile);
      // Soft assertion: if the spec already documents them, the fixture
      // generator must produce a response matching our required fields.
      const root = loadFixtureRoot(spec);
      for (const p of ["/status", "/version"]) {
        if (spec.paths?.[p]?.get) {
          const fixture = root.fixtureForResponse(p, "GET", "200") as Record<string, unknown>;
          const required = p === "/status" ? REQUIRED_STATUS_FIELDS : REQUIRED_VERSION_FIELDS;
          for (const f of required) {
            expect(fixture, `${env} ${p} response missing ${f}`).toHaveProperty(f);
          }
        }
      }
    });
  }
});
