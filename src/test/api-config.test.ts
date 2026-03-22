import { describe, it, expect } from "vitest";

describe("API Configuration", () => {
  it("should have correct base URL format", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.BASE_URL).toContain("kangopenbanking.com");
    expect(API_CONFIG.BASE_URL).toContain("functions/v1");
  });

  it("should have fallback URL configured", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.BASE_URL_FALLBACK).toContain("supabase.co");
  });

  it("should have all required endpoints", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.OPENAPI_SPEC).toBeDefined();
    expect(API_CONFIG.POSTMAN_COLLECTION).toBeDefined();
    expect(API_CONFIG.DOCS_URL).toBeDefined();
    expect(API_CONFIG.EXPLORER_URL).toBeDefined();
  });

  it("should have static spec file paths", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.OPENAPI_JSON).toBe("/openapi.json");
    expect(API_CONFIG.OPENAPI_YAML).toBe("/openapi.yaml");
    expect(API_CONFIG.OPENAPI_SANDBOX_JSON).toBe("/openapi-sandbox.json");
    expect(API_CONFIG.OPENAPI_SANDBOX_YAML).toBe("/openapi-sandbox.yaml");
  });

  it("should have SITE_URL configured", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.SITE_URL).toBe("https://kangopenbanking.com");
  });
});
