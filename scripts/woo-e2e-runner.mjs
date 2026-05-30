#!/usr/bin/env node
/**
 * scripts/woo-e2e-runner.mjs
 *
 * CI-friendly runner for the WooCommerce module E2E probes.
 *
 * Calls the `woocommerce-e2e-probe` edge function, prints the report, and
 * exits non-zero on any failure (edge function, table read, or marketplace
 * regression). Used by .github/workflows/woocommerce-e2e.yml.
 */
const BASE =
  process.env.WOO_E2E_BASE_URL ||
  "https://wdzkzeahdtxlynetndqw.supabase.co";
const ANON =
  process.env.WOO_E2E_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indkemt6ZWFoZHR4bHluZXRuZHF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4OTQ1OTksImV4cCI6MjA4ODQ3MDU5OX0.i-5Sx5xz2ntXQ9mTEfOJ4PQKuaeWRycvbkAQQfx2zYg";

const url = `${BASE}/functions/v1/woocommerce-e2e-probe`;
console.log(`[woo-e2e] POST ${url}`);

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
  body: "{}",
});
const body = await res.json().catch(() => ({ ok: false, error: "invalid_json" }));
console.log(JSON.stringify(body, null, 2));

if (!body.ok) {
  const fails = (body.checks || []).filter((c) => c.status === "fail");
  console.error(`\n[woo-e2e] FAILED — ${fails.length} regression(s) detected`);
  for (const f of fails) console.error(`  - ${f.check}: ${f.error || `http ${f.http}`}`);
  process.exit(1);
}
console.log(`\n[woo-e2e] PASS — ${body.total} checks, 0 failures`);
