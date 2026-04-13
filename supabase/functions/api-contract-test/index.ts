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
 * Invoke: GET /functions/v1/api-contract-test
 */
import { corsHeaders } from "../_shared/cors.ts";

const BASE = Deno.env.get("SUPABASE_URL")! + "/functions/v1";
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

interface TestResult {
  name: string;
  passed: boolean;
  status: number | null;
  content_type: string | null;
  latency_ms: number;
  error?: string;
}

async function testEndpoint(name: string, url: string, method = "GET", body?: unknown): Promise<TestResult> {
  const start = Date.now();
  try {
    const init: RequestInit = {
      method,
      headers: { apikey: ANON, "Content-Type": "application/json" },
    };
    if (body) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    const ct = res.headers.get("content-type") || "";
    const latency = Date.now() - start;
    const isJson = ct.includes("application/json");
    const isHtml = ct.includes("text/html");
    const text = await res.text();

    // Try to parse as JSON to double-check
    let validJson = false;
    try { JSON.parse(text); validJson = true; } catch { /* not json */ }

    const passed = isJson && !isHtml && validJson;
    return {
      name,
      passed,
      status: res.status,
      content_type: ct,
      latency_ms: latency,
      error: passed ? undefined : `Expected JSON, got ${ct}${!validJson ? " (body not valid JSON)" : ""}`,
    };
  } catch (err: any) {
    return {
      name,
      passed: false,
      status: null,
      content_type: null,
      latency_ms: Date.now() - start,
      error: err.message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const results: TestResult[] = [];

  // --- Core public endpoints ---
  results.push(await testEndpoint("Health Check", `${BASE}/api-health`));
  results.push(await testEndpoint("OpenAPI Spec", `${BASE}/public-api-spec`));
  results.push(await testEndpoint("OIDC Discovery", `${BASE}/oidc-config`));
  results.push(await testEndpoint("Postman Collection", `${BASE}/postman-collection`));

  // --- Fee estimate (standalone) ---
  results.push(await testEndpoint(
    "Fee Estimate (standalone)",
    `${BASE}/gateway-fee-estimate?amount=5000&channel=mobile_money&currency=XAF`
  ));

  // --- All 8 payment channels via charges router ---
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
      `${BASE}/gateway-charges-router?action=fee_estimate&amount=${ch.amount}&channel=${ch.channel}&currency=${ch.currency}`
    ));
  }

  // --- Protected routers (expect 401/400 JSON, NOT HTML) ---
  const protectedRouters = [
    { name: "Payouts Router (401)", path: "/gateway-payouts-router", body: { action: "list" } },
    { name: "Disputes Router (401)", path: "/gateway-disputes-router", body: { action: "list" } },
    { name: "Merchant Router (401)", path: "/gateway-merchant-router", body: { action: "list" } },
    { name: "Webhooks Router (401)", path: "/gateway-webhooks-router", body: { action: "endpoints" } },
    { name: "Settlement Router (400)", path: "/gateway-settlement-router", body: { action: "list" } },
    { name: "Banking Router (400)", path: "/banking-api-router", body: { action: "status" } },
  ];

  for (const rt of protectedRouters) {
    results.push(await testEndpoint(rt.name, `${BASE}${rt.path}`, "POST", rt.body));
  }

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  return new Response(JSON.stringify({
    summary: {
      total,
      passed,
      failed: total - passed,
      all_passing: passed === total,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
    results,
    failures: failed.length > 0 ? failed : undefined,
  }, null, 2), {
    status: passed === total ? 200 : 207,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
