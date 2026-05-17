#!/usr/bin/env node
/**
 * Phase 5 — Observability & SLOs spec hardening.
 *
 * Additive only (Standing Orders 1 & 4):
 *   - bump info.version 4.35.0 → 4.36.0
 *   - introduce X-Trace-Id response header on every operation (alongside X-Request-Id)
 *   - add top-level vendor extension `x-observability` documenting:
 *       trace-id header name, trace propagation contract (W3C traceparent),
 *       SLO targets (charge success, webhook delivery, latency p50/p95/p99)
 *
 * No paths, operationIds, schemas, or security schemes are renamed or removed.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];

const NEW_VERSION = "4.36.0";
const TRACE_HEADER_NAME = "X-Trace-Id";

const observabilityBlock = {
  trace_header: TRACE_HEADER_NAME,
  request_header: "X-Request-Id",
  propagation: "W3C Trace Context (`traceparent`) is accepted; if absent or invalid, a UUID v4 is generated and returned in X-Trace-Id.",
  slo_targets: {
    charge_success_rate_24h: ">= 99.5%",
    webhook_delivery_success_rate_24h: ">= 99.0%",
    charge_latency_ms: { p50: 200, p95: 800, p99: 1500 },
  },
  dashboard: "/admin/slo",
};

function injectTraceHeaderOnResponses(operation) {
  if (!operation || typeof operation !== "object") return 0;
  const responses = operation.responses || {};
  let touched = 0;
  for (const code of Object.keys(responses)) {
    const r = responses[code];
    if (!r || typeof r !== "object") continue;
    r.headers ||= {};
    if (!r.headers[TRACE_HEADER_NAME]) {
      r.headers[TRACE_HEADER_NAME] = {
        description: "Distributed trace identifier for this request. Echoes the inbound X-Trace-Id or W3C traceparent when present; otherwise a server-generated UUID v4.",
        schema: { type: "string" },
      };
      touched += 1;
    }
  }
  return touched;
}

const METHODS = ["get", "post", "put", "patch", "delete", "options", "head"];

for (const file of SPECS) {
  const raw = fs.readFileSync(file, "utf-8");
  const spec = JSON.parse(raw);
  const prev = spec.info?.version;
  spec.info.version = NEW_VERSION;
  spec["x-observability"] = observabilityBlock;

  let opsTouched = 0;
  let respTouched = 0;
  for (const p of Object.values(spec.paths || {})) {
    for (const m of METHODS) {
      if (p && p[m]) {
        const n = injectTraceHeaderOnResponses(p[m]);
        if (n > 0) {
          opsTouched += 1;
          respTouched += n;
        }
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + "\n", "utf-8");
  console.log(`[phase5] ${path.basename(file)}: ${prev} → ${NEW_VERSION}; ops=${opsTouched}, responses=${respTouched}`);
}

console.log("[phase5] OpenAPI hardening done.");
