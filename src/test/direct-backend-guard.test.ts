import { describe, it, expect } from "vitest";

/**
 * DIRECT BACKEND REGRESSION GUARD — PERMANENT (Standing Order 2)
 *
 * Ensures the runtime API surface always uses the direct Supabase Edge
 * Functions hostname. The branded gateway hostname (api.kangopenbanking.com)
 * is now SERVED by a Cloudflare Worker (/worker) that proxies to the same
 * Supabase backend, so it is allowed in DOCUMENTATION-ONLY variables
 * (API_PUBLIC_GATEWAY_URL, API_EXAMPLE_BASE_URL) but is STILL FORBIDDEN
 * in runtime variables (API_BACKEND_BASE, API_RUNTIME_BASE_URL,
 * API_CONFIG.BASE_URL, OPENAPI_SPEC, POSTMAN_COLLECTION).
 *
 * Tests can only be ADDED, never removed.
 */

const FORBIDDEN_RUNTIME_DOMAINS = [
  "api.kangopenbanking.com",
  "sandbox.kangopenbanking.com",
  "mtls.api.kangopenbanking.com",
];

describe("Direct Backend Regression Guard", () => {
  it("API_CONFIG.BASE_URL (runtime) must not contain forbidden domains", async () => {
    const { API_CONFIG } = await import("@/config/api");
    for (const domain of FORBIDDEN_RUNTIME_DOMAINS) {
      expect(API_CONFIG.BASE_URL).not.toContain(domain);
    }
  });

  it("API_CONFIG.BASE_URL (runtime) must contain functions/v1", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.BASE_URL).toContain("functions/v1");
  });

  it("API_BACKEND_BASE (runtime) must not contain forbidden domains", async () => {
    const { API_BACKEND_BASE } = await import("@/config/api");
    for (const domain of FORBIDDEN_RUNTIME_DOMAINS) {
      expect(API_BACKEND_BASE).not.toContain(domain);
    }
  });

  it("API_RUNTIME_BASE_URL must not contain forbidden domains", async () => {
    const { API_RUNTIME_BASE_URL } = await import("@/config/api");
    for (const domain of FORBIDDEN_RUNTIME_DOMAINS) {
      expect(API_RUNTIME_BASE_URL).not.toContain(domain);
    }
    expect(API_RUNTIME_BASE_URL).toContain("functions/v1");
  });

  it("OPENAPI_SPEC must use direct backend", async () => {
    const { API_CONFIG } = await import("@/config/api");
    for (const domain of FORBIDDEN_RUNTIME_DOMAINS) {
      expect(API_CONFIG.OPENAPI_SPEC).not.toContain(domain);
    }
    expect(API_CONFIG.OPENAPI_SPEC).toContain("functions/v1");
  });

  it("POSTMAN_COLLECTION must use direct backend", async () => {
    const { API_CONFIG } = await import("@/config/api");
    for (const domain of FORBIDDEN_RUNTIME_DOMAINS) {
      expect(API_CONFIG.POSTMAN_COLLECTION).not.toContain(domain);
    }
    expect(API_CONFIG.POSTMAN_COLLECTION).toContain("functions/v1");
  });

  /**
   * Display-only variables are PERMITTED to expose the branded gateway
   * hostname because it is backed by a Cloudflare Worker (/worker) that
   * proxies to the same Supabase Edge Functions origin. They must never
   * be used for runtime calls — the runtime variables above are the
   * authoritative source of truth.
   */
  it("API_PUBLIC_GATEWAY_URL must be the branded gateway, never the Supabase URL", async () => {
    const { API_PUBLIC_GATEWAY_URL } = await import("@/config/api");
    expect(API_PUBLIC_GATEWAY_URL).toBe("https://api.kangopenbanking.com/v1");
  });

  it("API_EXAMPLE_BASE_URL must equal the branded gateway URL", async () => {
    const { API_EXAMPLE_BASE_URL, API_PUBLIC_GATEWAY_URL } = await import("@/config/api");
    expect(API_EXAMPLE_BASE_URL).toBe(API_PUBLIC_GATEWAY_URL);
  });
});
