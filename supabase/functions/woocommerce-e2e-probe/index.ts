// woocommerce-e2e-probe
// Lightweight CI/sandbox smoke check for the Woo integration surface.
// Public (no auth). Returns a structured pass/fail report covering:
//   - Each Woo edge function responds (auth-gate probe)
//   - DB tables are readable via service role
//   - Marketplace read path (pos_products with source='woocommerce') is alive
//
// The CI runner asserts {ok: true} and that no individual check is "fail".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const FUNCTIONS = [
  "woocommerce-register-merchant",
  "woocommerce-validate-install",
  "woocommerce-process-payment",
  "woocommerce-transaction-sync",
  "woocommerce-download-plugin",
  "woocommerce-admin-clear-demo",
  "woocommerce-payment-webhook",
  "pos-woo-connector",
  "pos-woo-webhook-ingestion",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc = createClient(baseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const checks: any[] = [];

  // 1. Edge function reachability + auth gate
  for (const fn of FUNCTIONS) {
    try {
      const res = await fetch(`${baseUrl}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anon },
        body: "{}",
        signal: AbortSignal.timeout(8000),
      });
      // Acceptable: 200/400/401/403/404 (function responded). 5xx = fail.
      const status = res.status < 500 ? "pass" : "fail";
      checks.push({ check: `fn:${fn}`, status, http: res.status });
      await res.text();
    } catch (e) {
      checks.push({
        check: `fn:${fn}`,
        status: "fail",
        error: e instanceof Error ? e.message : "unreachable",
      });
    }
  }

  // 2. DB table readability
  const tables = [
    "woocommerce_merchants",
    "woocommerce_transactions",
    "merchant_integrations",
    "integration_mappings",
    "integration_sync_runs",
    "integration_events_inbox",
    "pos_products",
    "pos_product_variants",
  ];
  for (const t of tables) {
    const { error, count } = await svc.from(t).select("*", { count: "exact", head: true });
    checks.push({
      check: `tbl:${t}`,
      status: error ? "fail" : "pass",
      rows: count ?? 0,
      error: error?.message,
    });
  }

  // 3. Marketplace read path — imported Woo products surface for consumers.
  const { error: mpErr, count: mpCount } = await svc
    .from("pos_products")
    .select("id", { count: "exact", head: true })
    .eq("source", "woocommerce");
  checks.push({
    check: "marketplace:woocommerce_products",
    status: mpErr ? "fail" : "pass",
    rows: mpCount ?? 0,
    error: mpErr?.message,
  });

  const failures = checks.filter((c) => c.status === "fail");
  return new Response(
    JSON.stringify(
      {
        ok: failures.length === 0,
        ran_at: new Date().toISOString(),
        total: checks.length,
        failed: failures.length,
        checks,
      },
      null,
      2,
    ),
    {
      status: failures.length === 0 ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
