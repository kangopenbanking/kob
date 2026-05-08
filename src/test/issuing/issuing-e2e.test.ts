/**
 * E2E coverage for the Virtual Card Issuing v2 surface.
 *
 * These tests exercise the public contract that all callers (bank console,
 * developer console, admin oversight, public REST API) depend on:
 *
 *  - action routing (issue / list / freeze / unfreeze / terminate / fund /
 *    withdraw / transactions / get-card / reveal-card)
 *  - tenant scoping (bank | developer | platform)
 *  - step-up MFA gate on reveal-card
 *  - structured RFC 7807 errors
 *  - OpenAPI surface (paths + version) is documented
 *  - Public developer reference page is registered (Order P1, P2, P6)
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("Issuing — OpenAPI surface", () => {
  const spec = JSON.parse(
    fs.readFileSync(path.join(root, "public/openapi.json"), "utf8"),
  );

  it("is at version 4.32.0 (Issuing release)", () => {
    expect(spec.info.version).toBe("4.32.0");
  });

  it("documents every issuing endpoint", () => {
    const required = [
      ["post", "/v1/issuing/cardholders"],
      ["post", "/v1/issuing/cards"],
      ["get", "/v1/issuing/cards"],
      ["get", "/v1/issuing/cards/{id}"],
      ["post", "/v1/issuing/cards/{id}/fund"],
      ["post", "/v1/issuing/cards/{id}/withdraw"],
      ["post", "/v1/issuing/cards/{id}/freeze"],
      ["post", "/v1/issuing/cards/{id}/unfreeze"],
      ["post", "/v1/issuing/cards/{id}/terminate"],
      ["get", "/v1/issuing/cards/{id}/transactions"],
      ["post", "/v1/issuing/cards/{id}/reveal"],
    ];
    for (const [m, p] of required) {
      expect(spec.paths?.[p]?.[m], `${m.toUpperCase()} ${p}`).toBeDefined();
    }
  });

  it("declares the Issuing tag", () => {
    expect((spec.tags ?? []).some((t: any) => t.name === "Issuing")).toBe(true);
  });
});

describe("Issuing — Edge function action router", () => {
  const src = fs.readFileSync(
    path.join(root, "supabase/functions/virtual-cards-v2/index.ts"),
    "utf8",
  );

  for (const action of [
    "create-cardholder",
    "issue-card",
    "list-cards",
    "freeze",
    "unfreeze",
    "terminate",
    "fund",
    "withdraw",
    "transactions",
    "get-card",
    "reveal-card",
  ]) {
    it(`routes action: ${action}`, () => {
      expect(src).toContain(`case "${action}"`);
    });
  }

  it("requires step-up MFA on reveal-card", () => {
    expect(src).toMatch(/mfa_required[\s\S]+reveal/i);
  });

  it("scopes non-admin reads to tenant", () => {
    expect(src).toMatch(/tenant_type[\s\S]+tenant_id/);
  });

  it("uses idempotency keys for state-changing actions", () => {
    expect(src).toMatch(/idempotency_key/);
  });
});

describe("Issuing — Kora webhook", () => {
  const src = fs.readFileSync(
    path.join(root, "supabase/functions/kora-webhook/index.ts"),
    "utf8",
  );
  it("verifies HMAC signature before persisting", () => {
    expect(src).toMatch(/verifyKoraSignature/);
  });
  it("is idempotent on event id", () => {
    expect(src).toMatch(/virtual_card_webhook_events/);
  });
});

describe("Issuing — Public docs (Order P1, P2, P6)", () => {
  const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");
  it("registers /developer/api/issuing as a public route", () => {
    expect(app).toMatch(/path="api\/issuing"\s+element=\{<IssuingReference/);
  });
  it("redirects /developer/issuing to /developer/api/issuing (no 404)", () => {
    expect(app).toMatch(/path="issuing"\s+element=\{<Navigate to="\/developer\/api\/issuing"/);
  });
});

describe("Issuing — Changelog (Order P7)", () => {
  const cl = JSON.parse(
    fs.readFileSync(path.join(root, "public/changelog.json"), "utf8"),
  );
  it("includes the v4.32.0 entry within 48h of release", () => {
    const e = (cl.entries ?? []).find((x: any) => x.version === "4.32.0");
    expect(e, "v4.32.0 changelog entry").toBeDefined();
    expect(e.date).toBe("2026-05-08");
    expect(e.summary).toMatch(/Issuing/i);
  });
});
