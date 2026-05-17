#!/usr/bin/env node
/**
 * Phase 7 (Fraud & Risk) + Phase 8 (Scalability & DX) — spec hardening.
 * Additive only (Standing Orders 1 & 4):
 *   - bump info.version to FINAL_VERSION
 *   - add `x-risk` vendor extension (blocklists, baselines, fail-closed policy)
 *   - add `x-scalability` vendor extension (kv cache + SDK matrix + load harness)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];
const FINAL_VERSION = "4.40.0"; // Phase 7 (4.39.0) then 8 (4.40.0) collapsed into one delivery cycle

const riskBlock = {
  blocklist_table: "public.risk_blocklists",
  blocklist_identifier_types: ["msisdn", "email", "iban", "device_id", "ip"],
  blocklist_severities: ["low", "medium", "high", "critical"],
  baseline_table: "public.merchant_risk_baselines",
  baseline_window_days: 30,
  baseline_metrics: ["charge_count", "avg_amount", "p95_amount", "max_amount", "decline_rate", "distinct_customers"],
  fail_closed: {
    flag: "risk_fail_closed_enabled",
    threshold_config: "risk_fail_closed_threshold_xaf",
    threshold_default_xaf: 1000000,
    behavior_when_enabled:
      "POST /v1/gateway/risk/score returns action=block (not fail-open) on internal error if amount_xaf > threshold.",
  },
  standards: ["PSD2 RTS Art. 18 (Transaction Risk Analysis)", "FATF Rec. 10 (CDD)", "COBAC AML"],
};

const scalabilityBlock = {
  kv_cache_table: "public.kv_cache",
  kv_cache_uses: [
    "OIDC discovery doc cache (TTL 600s)",
    "JWKS cache (TTL 3600s)",
    "Rate-limit counter buckets (TTL 60s)",
  ],
  typed_sdk_matrix: {
    hand_tuned: ["packages/sdk-node", "packages/sdk-python", "packages/sdk-php", "packages/sdk-go"],
    auto_generated: ["sdks/generated/typescript", "sdks/generated/python", "sdks/generated/go", "sdks/generated/java"],
  },
  load_harness: {
    runner: "k6",
    location: "e2e/load/",
    scenarios: ["charge-burst.js", "webhook-flood.js", "aisp-read-storm.js"],
    slo_targets: {
      charge_p95_ms: 1500,
      webhook_p95_ms: 800,
      aisp_p95_ms: 600,
      error_rate_max: 0.005,
    },
  },
  standards: ["Stripe load-test methodology", "Adyen capacity-planning guide", "KOB SO-5 Dead-Code Rule"],
};

for (const file of SPECS) {
  const spec = JSON.parse(fs.readFileSync(file, "utf-8"));
  const prev = spec.info?.version;
  spec.info.version = FINAL_VERSION;
  spec["x-risk"] = riskBlock;
  spec["x-scalability"] = scalabilityBlock;
  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + "\n", "utf-8");
  console.log(`[phase7+8] ${path.basename(file)}: ${prev} → ${FINAL_VERSION}`);
}

// Also mirror to YAML (lightweight string replace on info.version)
for (const yamlFile of [path.join(ROOT, "public/openapi.yaml"), path.join(ROOT, "public/openapi-sandbox.yaml")]) {
  if (!fs.existsSync(yamlFile)) continue;
  const txt = fs.readFileSync(yamlFile, "utf-8").replace(/version:\s*["']?[\d.]+["']?/, `version: "${FINAL_VERSION}"`);
  fs.writeFileSync(yamlFile, txt);
  console.log(`[phase7+8] ${path.basename(yamlFile)} → ${FINAL_VERSION}`);
}

console.log("[phase7+8] OpenAPI hardening done.");
