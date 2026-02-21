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
});
