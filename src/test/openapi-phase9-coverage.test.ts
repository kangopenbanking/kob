/**
 * Phase 9 ratchet — guards every additive change made in
 * `scripts/phase9-spec-hardening.mjs`. Per Standing Order #2, once these
 * components/operations exist they MUST NOT be removed.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SPEC = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "public/openapi.json"), "utf-8"),
);

describe("Phase 9 — High-priority gaps (additive ratchet)", () => {
  it("info.version is at least 4.43.0", () => {
    const [maj, min] = SPEC.info.version.split(".").map(Number);
    expect(maj).toBeGreaterThanOrEqual(4);
    if (maj === 4) expect(min).toBeGreaterThanOrEqual(43);
  });

  // ---- G8 — W3C Trace Context ----
  it("declares Traceparent + Tracestate request parameters", () => {
    expect(SPEC.components.parameters.Traceparent).toBeDefined();
    expect(SPEC.components.parameters.Tracestate).toBeDefined();
    expect(SPEC.components.parameters.Traceparent.schema.pattern).toMatch(/0-9a-f/);
  });

  it("declares a Traceparent response header component", () => {
    expect(SPEC.components.headers.Traceparent).toBeDefined();
  });

  // ---- G6 — Mobile-money error normalization ----
  it("declares MobileMoneyErrorCode + MobileMoneyProviderError schemas", () => {
    expect(SPEC.components.schemas.MobileMoneyErrorCode).toBeDefined();
    expect(SPEC.components.schemas.MobileMoneyErrorCode.enum).toContain("insufficient_funds");
    expect(SPEC.components.schemas.MobileMoneyProviderError).toBeDefined();
  });

  // ---- G7 — Consent lifecycle ----
  it("exposes the /v1/consents façade", () => {
    expect(SPEC.paths["/v1/consents"]).toBeDefined();
    expect(SPEC.paths["/v1/consents"].post).toBeDefined();
    expect(SPEC.paths["/v1/consents"].get).toBeDefined();
    expect(SPEC.paths["/v1/consents/{consentId}"]).toBeDefined();
    expect(SPEC.paths["/v1/consents/{consentId}"].delete).toBeDefined();
    expect(SPEC.paths["/v1/consents/{consentId}/extend"]).toBeDefined();
  });

  // ---- G9 — camt.053 statements ----
  it("exposes the /v1/statements endpoints", () => {
    expect(SPEC.paths["/v1/statements"]).toBeDefined();
    expect(SPEC.paths["/v1/statements"].post).toBeDefined();
    expect(SPEC.paths["/v1/statements/{statementId}"]).toBeDefined();
    expect(SPEC.paths["/v1/statements/{statementId}/content"]).toBeDefined();
    const xmlContent =
      SPEC.paths["/v1/statements/{statementId}/content"].get.responses["200"].content;
    expect(xmlContent["application/xml"]).toBeDefined();
  });

  // ---- Bonus — per-tier rate limits ----
  it("publishes /v1/rate-limits with three tiers", () => {
    expect(SPEC.paths["/v1/rate-limits"]).toBeDefined();
    expect(SPEC.components.schemas.RateLimitTier).toBeDefined();
    const tiers = SPEC.components.schemas.RateLimitTier.properties.tier.enum;
    expect(tiers).toEqual(expect.arrayContaining(["free", "pro", "enterprise"]));
  });
});
