import { describe, expect, it } from "vitest";

// Inline copy of the rewriter for unit testing in isolation.
function rewritePath(pathname: string): string {
  if (pathname === "/openapi.json") return "/functions/v1/public-api-spec";
  if (pathname === "/openapi.yaml") return "/functions/v1/public-api-spec.yaml";
  if (pathname === "/health" || pathname === "/healthz") return "/functions/v1/health-check";
  if (pathname.startsWith("/functions/v1/")) return pathname;
  if (pathname.startsWith("/v1/")) return "/functions/v1" + pathname.substring(3);
  if (pathname === "/v1") return "/functions/v1";
  if (pathname === "/" || pathname === "") return "/functions/v1/public-api-spec";
  return "/functions/v1" + pathname;
}

describe("gateway path rewriter", () => {
  it("rewrites /v1/<resource> to /functions/v1/<resource>", () => {
    expect(rewritePath("/v1/transactions")).toBe("/functions/v1/transactions");
    expect(rewritePath("/v1/oauth/token")).toBe("/functions/v1/oauth/token");
  });
  it("aliases /openapi.json and /openapi.yaml to the spec endpoint", () => {
    expect(rewritePath("/openapi.json")).toBe("/functions/v1/public-api-spec");
    expect(rewritePath("/openapi.yaml")).toBe("/functions/v1/public-api-spec.yaml");
  });
  it("aliases /health and /healthz to the health-check endpoint", () => {
    expect(rewritePath("/health")).toBe("/functions/v1/health-check");
    expect(rewritePath("/healthz")).toBe("/functions/v1/health-check");
  });
  it("preserves already-prefixed origin paths", () => {
    expect(rewritePath("/functions/v1/api-transactions")).toBe("/functions/v1/api-transactions");
  });
  it("falls back to forwarding under /functions/v1/", () => {
    expect(rewritePath("/api-transactions")).toBe("/functions/v1/api-transactions");
  });
});
