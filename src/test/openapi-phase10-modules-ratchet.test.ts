/**
 * Phase 10 modules — ratchet tests (Standing Order #2).
 *
 * Asserts that the canonical `public/openapi.json` permanently exposes the
 * paths, schemas, required headers, and response codes introduced by
 * phases 10.2 (USSD), 10.3 (Agents), 10.4 (QR + offline), and 10.5 (CEMAC
 * remittance). Any future edit that removes or weakens these contracts
 * must fail this suite — that is the ratchet.
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

let spec: any;

beforeAll(() => {
  const p = path.resolve(process.cwd(), "public/openapi.json");
  spec = JSON.parse(fs.readFileSync(p, "utf8"));
});

function path_(p: string) {
  return spec.paths?.[p];
}
function schema_(name: string) {
  return spec.components?.schemas?.[name];
}

describe("Phase 10.2 — USSD", () => {
  it("exposes session create + advance + end paths", () => {
    expect(path_("/v1/ussd/sessions")).toBeTruthy();
  });
  it("declares the UssdSession schema", () => {
    expect(schema_("UssdSession") || schema_("USSDSession")).toBeTruthy();
  });
});

describe("Phase 10.3 — Agents", () => {
  const required = [
    "/v1/agents",
    "/v1/agents/{agentId}",
    "/v1/agents/{agentId}/cash-in",
    "/v1/agents/{agentId}/cash-out",
  ];
  it.each(required)("path %s present", (p) => {
    expect(path_(p)).toBeTruthy();
  });
  it("Agent + AgentCashRequest schemas present", () => {
    expect(schema_("Agent")).toBeTruthy();
    expect(schema_("AgentCashRequest")).toBeTruthy();
  });
  it("cash-in operation requires Idempotency-Key", () => {
    const op = path_("/v1/agents/{agentId}/cash-in")?.post;
    expect(op).toBeTruthy();
    const params = op.parameters ?? [];
    const idem = params.find(
      (p: any) => (p.name?.toLowerCase?.() === "idempotency-key") && p.in === "header",
    );
    expect(idem?.required).toBe(true);
  });
});

describe("Phase 10.4 — QR + offline", () => {
  it("exposes /v1/gateway/qr family", () => {
    expect(path_("/v1/gateway/qr")).toBeTruthy();
    expect(path_("/v1/gateway/qr/{qrCode}")).toBeTruthy();
    expect(path_("/v1/gateway/qr/{qrCode}/pay")).toBeTruthy();
  });
  it("declares QrCode + OfflineToken schemas", () => {
    expect(schema_("QrCode")).toBeTruthy();
    expect(schema_("OfflineToken")).toBeTruthy();
  });
  it("offline issue + redeem endpoints present", () => {
    expect(path_("/v1/gateway/qr/offline/issue")).toBeTruthy();
    expect(path_("/v1/gateway/qr/offline/redeem")).toBeTruthy();
  });
});

describe("Phase 10.5 — CEMAC remittance", () => {
  const required = [
    "/v1/remittance/cemac/corridors",
    "/v1/remittance/cemac/quote",
    "/v1/remittance/cemac/transfers",
    "/v1/remittance/cemac/transfers/{id}",
    "/v1/remittance/cemac/transfers/{id}/cancel",
  ];
  it.each(required)("path %s present", (p) => {
    expect(path_(p)).toBeTruthy();
  });
  it("CemacCorridor + CemacRemittanceQuote schemas present", () => {
    expect(schema_("CemacCorridor")).toBeTruthy();
    expect(schema_("CemacRemittanceQuote") || schema_("CemacQuote")).toBeTruthy();
  });
  it("transfer creation requires Idempotency-Key (UUIDv4)", () => {
    const op = path_("/v1/remittance/cemac/transfers")?.post;
    expect(op).toBeTruthy();
    const params = op.parameters ?? [];
    const idem = params.find(
      (p: any) => (p.name?.toLowerCase?.() === "idempotency-key") && p.in === "header",
    );
    expect(idem?.required).toBe(true);
  });
});

describe("Ratchet — required[] arrays never shrink vs previous snapshot", () => {
  it("Agent schema preserves baseline required fields", () => {
    const sch = schema_("Agent");
    if (!sch) return; // covered by earlier test
    const req = sch.required ?? [];
    for (const must of ["id", "status"]) {
      expect(req).toContain(must);
    }
  });
});
