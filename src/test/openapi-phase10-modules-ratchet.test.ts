/**
 * Phase 10 modules — ratchet tests (Standing Order #2).
 *
 * Conditional contract checks that lock the public/openapi.json shape for
 * each phase 10 module that is present in the spec. If a module's surface
 * has not yet shipped to openapi.json, its block is skipped with a
 * console.warn so the ratchet does not falsely "break" — but as soon as
 * the path/schema is added, every nested assertion is enforced.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Read the spec at collection time so conditional `it.skip` blocks can
// inspect the live shape *before* test bodies run.
const spec: any = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "public/openapi.json"), "utf8"),
);

const has = (sel: () => unknown): boolean => {
  try {
    return Boolean(sel());
  } catch {
    return false;
  }
};

function requireIdempotency(op: any) {
  const params = op?.parameters ?? [];
  const idem = params.find(
    (p: any) => p?.name?.toLowerCase?.() === "idempotency-key" && p?.in === "header",
  );
  expect(idem?.required).toBe(true);
}

describe("Phase 10.3 — Agents (must be locked)", () => {
  const requiredPaths = [
    "/v1/agents",
    "/v1/agents/{agentId}",
    "/v1/agents/{agentId}/cash-in",
    "/v1/agents/{agentId}/cash-out",
    "/v1/agents/{agentId}/float/topup",
    "/v1/agents/{agentId}/float/withdraw",
    "/v1/agents/{agentId}/transactions",
  ];
  it.each(requiredPaths)("path %s present", (p) => {
    expect(spec.paths?.[p]).toBeTruthy();
  });
  it("declares Agent + AgentCashRequest + AgentFloat schemas", () => {
    for (const name of ["Agent", "AgentCashRequest", "AgentFloat", "AgentRegisterRequest"]) {
      expect(spec.components?.schemas?.[name]).toBeTruthy();
    }
  });
  it("Agent schema preserves baseline required fields (ratchet)", () => {
    const req = spec.components?.schemas?.Agent?.required ?? [];
    for (const must of ["agent_code", "business_name", "country_code", "status"]) {
      expect(req).toContain(must);
    }
  });
  it("cash-in operation requires Idempotency-Key", () => {
    requireIdempotency(spec.paths?.["/v1/agents/{agentId}/cash-in"]?.post);
  });
  it("cash-out operation requires Idempotency-Key", () => {
    requireIdempotency(spec.paths?.["/v1/agents/{agentId}/cash-out"]?.post);
  });
});

describe("Phase 10.2 — USSD (locks once shipped to openapi.json)", () => {
  const present = has(() => spec.paths?.["/v1/ussd/sessions"]);
  (present ? it : it.skip)("UssdSession schema present", () => {
    expect(spec.components?.schemas?.UssdSession || spec.components?.schemas?.USSDSession).toBeTruthy();
  });
});

describe("Phase 10.4 — QR + offline (locks once shipped to openapi.json)", () => {
  const present = has(() => spec.paths?.["/v1/gateway/qr"]);
  (present ? it : it.skip)("QR + OfflineToken schemas present", () => {
    expect(spec.components?.schemas?.QrCode).toBeTruthy();
    expect(spec.components?.schemas?.OfflineToken).toBeTruthy();
  });
  (present ? it : it.skip)("offline issue + redeem endpoints present", () => {
    expect(spec.paths?.["/v1/gateway/qr/offline/issue"]).toBeTruthy();
    expect(spec.paths?.["/v1/gateway/qr/offline/redeem"]).toBeTruthy();
  });
});

describe("Phase 10.5 — CEMAC remittance (locks once shipped to openapi.json)", () => {
  const present = has(() => spec.paths?.["/v1/remittance/cemac/transfers"]);
  (present ? it : it.skip)("corridors + quote + cancel paths present", () => {
    expect(spec.paths?.["/v1/remittance/cemac/corridors"]).toBeTruthy();
    expect(spec.paths?.["/v1/remittance/cemac/quote"]).toBeTruthy();
    expect(spec.paths?.["/v1/remittance/cemac/transfers/{id}/cancel"]).toBeTruthy();
  });
  (present ? it : it.skip)("transfer creation requires Idempotency-Key", () => {
    requireIdempotency(spec.paths?.["/v1/remittance/cemac/transfers"]?.post);
  });
});

describe("Phase 11 — Admin operations (must be locked)", () => {
  const paths = [
    "/v1/admin/webhooks/test",
    "/v1/admin/api-keys",
    "/v1/admin/api-keys/{id}/rotate",
    "/v1/admin/api-keys/{id}/suspend",
    "/v1/admin/api-keys/{id}/revoke",
  ];
  it.each(paths)("admin path %s present", (p) => {
    expect(spec.paths?.[p]).toBeTruthy();
  });
  it("AdminApiKey + AdminTestWebhookRequest schemas present", () => {
    expect(spec.components?.schemas?.AdminApiKey).toBeTruthy();
    expect(spec.components?.schemas?.AdminTestWebhookRequest).toBeTruthy();
  });
});
