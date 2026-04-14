import { describe, it, expect } from "vitest";

/**
 * DIRECT BACKEND REGRESSION GUARD — PERMANENT (Standing Order 2)
 * 
 * Ensures no legacy custom API domains are reintroduced into active API assets.
 * Tests can only be ADDED, never removed.
 * 
 * Forbidden domains in active API config/spec/docs/examples:
 *   - api.kangopenbanking.com (serves SPA HTML, not edge functions)
 *   - sandbox.kangopenbanking.com (serves SPA HTML, not edge functions)
 *   - mtls.api.kangopenbanking.com (conceptual only)
 */

const FORBIDDEN_DOMAINS = [
  "api.kangopenbanking.com",
  "sandbox.kangopenbanking.com",
  "mtls.api.kangopenbanking.com",
];

describe("Direct Backend Regression Guard", () => {
  it("API_CONFIG.BASE_URL must not contain forbidden domains", async () => {
    const { API_CONFIG } = await import("@/config/api");
    for (const domain of FORBIDDEN_DOMAINS) {
      expect(API_CONFIG.BASE_URL).not.toContain(domain);
    }
  });

  it("API_CONFIG.BASE_URL must contain functions/v1", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.BASE_URL).toContain("functions/v1");
  });

  it("API_BACKEND_BASE must not contain forbidden domains", async () => {
    const { API_BACKEND_BASE } = await import("@/config/api");
    for (const domain of FORBIDDEN_DOMAINS) {
      expect(API_BACKEND_BASE).not.toContain(domain);
    }
  });

  it("OPENAPI_SPEC must use direct backend", async () => {
    const { API_CONFIG } = await import("@/config/api");
    for (const domain of FORBIDDEN_DOMAINS) {
      expect(API_CONFIG.OPENAPI_SPEC).not.toContain(domain);
    }
    expect(API_CONFIG.OPENAPI_SPEC).toContain("functions/v1");
  });

  it("POSTMAN_COLLECTION must use direct backend", async () => {
    const { API_CONFIG } = await import("@/config/api");
    for (const domain of FORBIDDEN_DOMAINS) {
      expect(API_CONFIG.POSTMAN_COLLECTION).not.toContain(domain);
    }
    expect(API_CONFIG.POSTMAN_COLLECTION).toContain("functions/v1");
  });

  it("API_EXAMPLE_BASE_URL must not contain forbidden domains", async () => {
    const { API_EXAMPLE_BASE_URL } = await import("@/config/api");
    for (const domain of FORBIDDEN_DOMAINS) {
      expect(API_EXAMPLE_BASE_URL).not.toContain(domain);
    }
  });
});
