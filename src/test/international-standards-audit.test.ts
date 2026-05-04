/**
 * International Standards E2E audit.
 * Asserts the OpenAPI spec exposes the metadata required by the
 * 10-point external audit (single base URL, pagination, errors,
 * deprecation, rate limits, sandbox guarantees, webhooks).
 */
import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

type Spec = Record<string, any>;

function loadSpec(rel: string): Spec {
  const p = path.resolve(process.cwd(), "public", rel);
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

const CANONICAL = "https://api.kangopenbanking.com/v1";

describe("International standards — production spec", () => {
  let spec: Spec;
  beforeAll(() => { spec = loadSpec("openapi.json"); });

  it("declares only canonical kangopenbanking.com base URLs (no Supabase leakage)", () => {
    const urls = (spec.servers ?? []).map((s: any) => s.url);
    expect(urls.length).toBeGreaterThan(0);
    // Production must be present and listed first.
    expect(urls[0]).toBe(CANONICAL);
    // All servers must be on kangopenbanking.com (production or sandbox subdomain), never Supabase.
    for (const u of urls) {
      expect(u).toMatch(/^https:\/\/(api|sandbox-api)\.kangopenbanking\.com\/v1$/);
      expect(u).not.toMatch(/supabase\.co|functions\/v1|wdzkzeahdtxlynetndqw/);
    }
    expect(spec["x-api-standards"]?.single_canonical_origin).toBe(true);
    expect(spec["x-api-standards"]?.internal_routing_exposed).toBe(false);
  });

  it("documents cursor pagination", () => {
    const p = spec["x-pagination"];
    expect(p).toBeTruthy();
    expect(p.style).toBe("cursor");
    expect(p.parameters?.limit).toBeTruthy();
    expect(p.parameters?.starting_after).toBeTruthy();
    expect(p.parameters?.ending_before).toBeTruthy();
    expect(p.response_envelope).toMatchObject({ object: "list", data: "array", has_more: "boolean" });
  });

  it("publishes a complete error catalog & HTTP status map", () => {
    const e = spec["x-error-catalog"];
    expect(e).toBeTruthy();
    expect(e.envelope).toMatchObject({ error: expect.any(String), error_code: expect.any(String), error_id: expect.any(String) });
    for (const code of ["400","401","403","404","409","422","429","500"]) {
      expect(e.http_status_map[code]).toBeTruthy();
    }
    for (const domain of ["AUTH_","PAY_","LED_","PISP_","AISP_","KYC_","WH_","RATE_"]) {
      expect(e.domains[domain]).toBeTruthy();
    }
  });

  it("publishes a deprecation policy with ≥180 day notice", () => {
    const d = spec["x-deprecation-policy"];
    expect(d).toBeTruthy();
    expect(d.minimum_notice_days).toBeGreaterThanOrEqual(180);
    expect(d.headers_emitted_on_deprecated_endpoints).toEqual(
      expect.arrayContaining(["Deprecation","Sunset","Link"])
    );
    expect(Array.isArray(d.backwards_compat_rules)).toBe(true);
  });

  it("publishes rate-limit tiers and 429 contract", () => {
    const r = spec["x-rate-limits"];
    expect(r).toBeTruthy();
    for (const tier of ["oauth_token","aisp","pisp","gateway"]) {
      expect(r.tiers[tier]).toMatchObject({ limit: expect.any(Number), window: expect.any(String) });
    }
    expect(r.response_headers).toEqual(
      expect.arrayContaining(["X-RateLimit-Limit","X-RateLimit-Remaining","X-RateLimit-Reset","Retry-After"])
    );
    expect(r.error_status).toBe(429);
  });

  it("publishes sandbox guarantees with deterministic test data", () => {
    const s = spec["x-sandbox"];
    expect(s).toBeTruthy();
    expect(s.deterministic).toBe(true);
    expect(s.free).toBe(true);
    expect(Object.keys(s.magic_amounts ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(s.test_cards ?? {}).length).toBeGreaterThan(0);
    expect(Object.keys(s.test_momo ?? {}).length).toBeGreaterThan(0);
  });

  it("publishes webhook policy + event catalog", () => {
    const w = spec["x-webhook-policy"];
    const events = spec["x-webhook-events"];
    expect(w).toBeTruthy();
    expect(w.signature_algorithm).toMatch(/HMAC-SHA256/i);
    expect(w.signature_header).toBe("X-Webhook-Signature");
    expect(w.event_id_header).toBe("X-Webhook-ID");
    expect(Array.isArray(w.retry_schedule_seconds)).toBe(true);
    expect(w.retry_schedule_seconds.length).toBeGreaterThanOrEqual(5);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(15);
  });

  it("publishes SDK ecosystem", () => {
    const sdks = spec["x-sdks"];
    expect(Array.isArray(sdks)).toBe(true);
    const langs = sdks.map((s: any) => (s.language ?? "").toLowerCase());
    expect(langs.some((l: string) => l.includes("node"))).toBe(true);
    expect(langs.some((l: string) => l.includes("python"))).toBe(true);
    expect(langs.some((l: string) => l.includes("php"))).toBe(true);
  });

  it("publishes SLA targets", () => {
    const sla = spec["x-sla"];
    expect(sla?.uptime_target).toBeTruthy();
    expect(sla?.p95_latency_ms).toMatchObject({
      auth: expect.any(Number), gateway: expect.any(Number), aisp: expect.any(Number),
    });
  });
});

describe("International standards — sandbox spec parity", () => {
  let spec: Spec;
  beforeAll(() => { spec = loadSpec("openapi-sandbox.json"); });

  it("sandbox spec also exposes all required extensions", () => {
    for (const k of [
      "x-api-standards","x-pagination","x-error-catalog","x-deprecation-policy",
      "x-rate-limits","x-sla","x-sandbox","x-webhook-policy","x-webhook-events","x-sdks",
    ]) {
      expect(spec[k], `${k} must exist on sandbox spec`).toBeTruthy();
    }
  });

  it("sandbox declares the canonical base URL with sandbox environment marker", () => {
    expect(spec["x-api-standards"]?.environment).toBe("sandbox");
  });
});
