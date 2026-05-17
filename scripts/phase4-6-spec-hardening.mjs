#!/usr/bin/env node
/**
 * Phase 4+6 — Orchestrator + Compliance spec hardening.
 * Additive only (Standing Orders 1 & 4):
 *   - bump info.version to FINAL_VERSION
 *   - add `x-payment-orchestrator` vendor extension (flag name, default, route, behaviour)
 *   - add `x-data-retention` vendor extension surfacing the seeded retention policy classes
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];
const FINAL_VERSION = "4.38.0"; // Phase 4 then 6 collapsed into one delivery cycle

const orchestratorBlock = {
  flag: "payment_orchestrator_enabled",
  default: false,
  route: "/functions/v1/payment-orchestrator",
  delegates_to: "/functions/v1/payment-router-charge",
  guarantees: [
    "Transparent passthrough when flag is OFF — zero behavioural change vs v4.36.0.",
    "Idempotency replay cache TTL extended to 24h via public.idempotency_cache_extended.",
    "Dead-letter queue public.charge_dlq captures charges that exhaust provider 5xx retries (admin replay surface in /admin/orchestrator).",
  ],
  response_header: "X-Orchestrator",
  response_header_values: ["passthrough", "active"],
};

const retentionBlock = {
  table: "public.data_retention_policies",
  legal_bases: ["COBAC AML horizon", "GDPR Art. 5(1)(c) & (e)", "PSD2 RTS Art. 36"],
  default_horizons: {
    kyc_documents: { retention_days: 2555, anonymize_after_days: 2190 },
    transactions: { retention_days: 3650 },
    consent_events: { retention_days: 2555 },
    webhook_deliveries: { retention_days: 365, anonymize_after_days: 180 },
  },
  consent_ledger_table: "public.consent_events",
  regulatory_export_table: "public.compliance_reports",
};

for (const file of SPECS) {
  const spec = JSON.parse(fs.readFileSync(file, "utf-8"));
  const prev = spec.info?.version;
  spec.info.version = FINAL_VERSION;
  spec["x-payment-orchestrator"] = orchestratorBlock;
  spec["x-data-retention"] = retentionBlock;
  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + "\n", "utf-8");
  console.log(`[phase4+6] ${path.basename(file)}: ${prev} → ${FINAL_VERSION}`);
}
console.log("[phase4+6] OpenAPI hardening done.");
