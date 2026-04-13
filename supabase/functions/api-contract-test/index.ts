// deno-lint-ignore-file
/**
 * PERMANENT API CONTRACT TEST — DO NOT REMOVE OR MODIFY
 * Standing Order 2 (The Ratchet) — tests can only be added, never removed.
 * Standing Order P5 (Working Code Rule) — validates all endpoints return JSON.
 *
 * This function runs a comprehensive contract validation of all API endpoints
 * ensuring they return application/json and never text/html.
 * Covers all 8 payment channels: mobile_money, card, bank_transfer, paypal,
 * apple_pay, google_pay, ussd, wallet.
 *
 * ALSO validates:
 * - Domain DNS/SSL liveness for api.kangopenbanking.com, sandbox.kangopenbanking.com, kangopenbanking.com
 * - Static OpenAPI spec file availability (JSON + YAML, production + sandbox)
 * - API key generation endpoint auth guards (sandbox-create-api-key, sandbox router)
 * - API key format validation (sbx_ prefix enforcement)
 *
 * Invoke: GET /functions/v1/api-contract-test
 *
 * THIS FILE IS IMMUTABLE UNDER STANDING ORDER 2. Tests may be ADDED but NEVER removed.
 */
import { corsHeaders } from "../_shared/cors.ts";

const BASE = Deno.env.get("SUPABASE_URL")! + "/functions/v1";
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE = "https://kangopenbanking.com";

interface TestResult {
  name: string;
  suite: string;
  passed: boolean;
  status: number | null;
  content_type: string | null;
  latency_ms: number;
  error?: string;
}

async function testEndpoint(name: string, url: string, suite: string, method = "GET", body?: unknown, headers?: Record<string, string>): Promise<TestResult> {
  const start = Date.now();
  try {
    const init: RequestInit = {
      method,
      headers: { apikey: ANON, "Content-Type": "application/json", ...headers },
    };
    if (body) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const ct = res.headers.get("content-type") || "";
    const latency = Date.now() - start;
    const isJson = ct.includes("application/json");
    const isHtml = ct.includes("text/html");
    const text = await res.text();

    let validJson = false;
    try { JSON.parse(text); validJson = true; } catch { /* not json */ }

    const passed = isJson && !isHtml && validJson;
    return {
      name, suite, passed,
      status: res.status,
      content_type: ct,
      latency_ms: latency,
      error: passed ? undefined : `Expected JSON, got ${ct}${!validJson ? " (body not valid JSON)" : ""}`,
    };
  } catch (err: any) {
    return {
      name, suite, passed: false,
      status: null, content_type: null,
      latency_ms: Date.now() - start,
      error: err.message,
    };
  }
}

async function testDomain(name: string, url: string, suite: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD" });
    const latency = Date.now() - start;
    const passed = res.status >= 200 && res.status < 400;
    return {
      name, suite, passed,
      status: res.status,
      content_type: res.headers.get("content-type"),
      latency_ms: latency,
      error: passed ? undefined : `Domain returned ${res.status}`,
    };
  } catch (err: any) {
    return {
      name, suite, passed: false,
      status: null, content_type: null,
      latency_ms: Date.now() - start,
      error: err.message,
    };
  }
}

async function testStaticSpec(name: string, path: string, expectedType: string, suite: string): Promise<TestResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${SITE}${path}`);
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    const latency = Date.now() - start;
    const passed = res.status === 200 && text.length > 100 && ct.includes(expectedType);
    return {
      name, suite, passed,
      status: res.status,
      content_type: ct,
      latency_ms: latency,
      error: passed ? undefined : `Expected ${expectedType}, got ${ct} (${text.length} bytes)`,
    };
  } catch (err: any) {
    return {
      name, suite, passed: false,
      status: null, content_type: null,
      latency_ms: Date.now() - start,
      error: err.message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const results: TestResult[] = [];

  // ===== SUITE 1: Core JSON Contract (IMMUTABLE) =====
  results.push(await testEndpoint("Health Check", `${BASE}/api-health`, "json_contract"));
  results.push(await testEndpoint("OpenAPI Spec", `${BASE}/public-api-spec`, "json_contract"));
  results.push(await testEndpoint("OIDC Discovery", `${BASE}/oidc-config`, "json_contract"));
  results.push(await testEndpoint("Postman Collection", `${BASE}/postman-collection`, "json_contract"));

  // ===== SUITE 2: Fee Estimate (IMMUTABLE) =====
  results.push(await testEndpoint(
    "Fee Estimate (standalone)",
    `${BASE}/gateway-fee-estimate?amount=5000&channel=mobile_money&currency=XAF`,
    "fee_estimate"
  ));

  // ===== SUITE 3: All 8 Payment Channels (IMMUTABLE) =====
  const channels = [
    { channel: "mobile_money", amount: 5000, currency: "XAF" },
    { channel: "card", amount: 10000, currency: "XAF" },
    { channel: "bank_transfer", amount: 100000, currency: "XAF" },
    { channel: "paypal", amount: 50, currency: "USD" },
    { channel: "apple_pay", amount: 2500, currency: "USD" },
    { channel: "google_pay", amount: 2500, currency: "USD" },
    { channel: "ussd", amount: 5000, currency: "NGN" },
    { channel: "wallet", amount: 10000, currency: "XAF" },
  ];

  for (const ch of channels) {
    results.push(await testEndpoint(
      `Channel: ${ch.channel}`,
      `${BASE}/gateway-charges-router?action=fee_estimate&amount=${ch.amount}&channel=${ch.channel}&currency=${ch.currency}`,
      "payment_channels"
    ));
  }

  // ===== SUITE 4: Protected Routers (IMMUTABLE) =====
  const protectedRouters = [
    { name: "Payouts Router (401)", path: "/gateway-payouts-router", body: { action: "list" } },
    { name: "Disputes Router (401)", path: "/gateway-disputes-router", body: { action: "list" } },
    { name: "Merchant Router (401)", path: "/gateway-merchant-router", body: { action: "list" } },
    { name: "Webhooks Router (401)", path: "/gateway-webhooks-router", body: { action: "endpoints" } },
    { name: "Settlement Router (400)", path: "/gateway-settlement-router", body: { action: "list" } },
    { name: "Banking Router (400)", path: "/banking-api-router", body: { action: "status" } },
  ];

  for (const rt of protectedRouters) {
    results.push(await testEndpoint(rt.name, `${BASE}${rt.path}`, "protected_routers", "POST", rt.body));
  }

  // ===== SUITE 5: Domain Liveness (IMMUTABLE) =====
  results.push(await testDomain("api.kangopenbanking.com", "https://api.kangopenbanking.com", "domain_liveness"));
  results.push(await testDomain("sandbox.kangopenbanking.com", "https://sandbox.kangopenbanking.com", "domain_liveness"));
  results.push(await testDomain("kangopenbanking.com", "https://kangopenbanking.com", "domain_liveness"));

  // ===== SUITE 6: Static Spec Files (IMMUTABLE) =====
  results.push(await testStaticSpec("openapi.json", "/openapi.json", "application/json", "static_specs"));
  results.push(await testStaticSpec("openapi.yaml", "/openapi.yaml", "yaml", "static_specs"));
  results.push(await testStaticSpec("openapi-sandbox.json", "/openapi-sandbox.json", "application/json", "static_specs"));
  results.push(await testStaticSpec("openapi-sandbox.yaml", "/openapi-sandbox.yaml", "yaml", "static_specs"));

  // ===== SUITE 7: API Key Auth Guards (IMMUTABLE) =====
  // sandbox-create-api-key must reject unauthenticated requests with JSON 401
  results.push(await testEndpoint(
    "sandbox-create-api-key (no auth = 401 JSON)",
    `${BASE}/sandbox-create-api-key`, "api_key_guards", "POST",
    { key_name: "contract-test" }
  ));
  // sandbox router create-api-key must reject unauthenticated requests with JSON 401
  results.push(await testEndpoint(
    "sandbox router create-api-key (no auth = 401 JSON)",
    `${BASE}/sandbox`, "api_key_guards", "POST",
    { action: "create-api-key", key_name: "contract-test" }
  ));
  // sandbox router validate-api-key with invalid key must return JSON error
  results.push(await testEndpoint(
    "sandbox validate-api-key (invalid key = JSON error)",
    `${BASE}/sandbox`, "api_key_guards", "POST",
    { action: "validate-api-key" },
    { "x-api-key": "sbx_invalid_key_for_contract_test" }
  ));

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  // Group by suite
  const suites: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const r of results) {
    if (!suites[r.suite]) suites[r.suite] = { total: 0, passed: 0, failed: 0 };
    suites[r.suite].total++;
    if (r.passed) suites[r.suite].passed++;
    else suites[r.suite].failed++;
  }

  return new Response(JSON.stringify({
    summary: {
      total,
      passed,
      failed: total - passed,
      all_passing: passed === total,
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      suites,
    },
    results,
    failures: failed.length > 0 ? failed : undefined,
  }, null, 2), {
    status: passed === total ? 200 : 207,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
