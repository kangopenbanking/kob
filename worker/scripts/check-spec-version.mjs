#!/usr/bin/env node
// ----------------------------------------------------------------------------
// Post-deploy: confirms the live worker is serving /openapi.json at the
// expected spec version AND that /docs renders the Swagger UI shell.
// ----------------------------------------------------------------------------
// Usage:
//   node worker/scripts/check-spec-version.mjs production
//   node worker/scripts/check-spec-version.mjs sandbox
//   BASE_URL=https://api.kangopenbanking.com EXPECTED_VERSION=4.51.5 \
//     node worker/scripts/check-spec-version.mjs
// Exits non-zero on any mismatch so it can gate CI.
// ----------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const env = (process.argv[2] || "production").toLowerCase();
const hostByEnv = {
  production: "https://api.kangopenbanking.com",
  sandbox: "https://sandbox-api.kangopenbanking.com",
};
const base = process.env.BASE_URL || hostByEnv[env];
if (!base) {
  console.error(`Unknown environment '${env}'. Use production|sandbox or set BASE_URL.`);
  process.exit(2);
}

// Source of truth: src/config/version.ts (KOB_API_VERSION).
function readExpectedVersion() {
  if (process.env.EXPECTED_VERSION) return process.env.EXPECTED_VERSION;
  const here = dirname(fileURLToPath(import.meta.url));
  const versionTs = resolve(here, "../../src/config/version.ts");
  const src = readFileSync(versionTs, "utf8");
  const m = src.match(/KOB_API_VERSION\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("Could not parse KOB_API_VERSION from src/config/version.ts");
  return m[1];
}

const expected = readExpectedVersion();
let failed = 0;
const pass = (m) => console.log(`  \u001b[32m\u2713\u001b[0m ${m}`);
const fail = (m) => { console.log(`  \u001b[31m\u2717\u001b[0m ${m}`); failed = 1; };

console.log(`Verifying ${env} edge → ${base} (expected spec v${expected})`);

// 1) /openapi.json — must be 200, JSON, info.version === expected
try {
  const r = await fetch(`${base}/openapi.json`, { redirect: "manual" });
  if (r.status !== 200) fail(`/openapi.json status ${r.status} (expected 200)`);
  else pass(`/openapi.json status 200`);
  const ct = r.headers.get("content-type") || "";
  if (!/json/i.test(ct)) fail(`/openapi.json content-type '${ct}' (expected JSON)`);
  else pass(`/openapi.json content-type ${ct}`);
  const body = await r.json();
  const got = body?.info?.version;
  if (got !== expected) fail(`/openapi.json info.version='${got}' (expected '${expected}')`);
  else pass(`/openapi.json info.version=${got}`);
} catch (e) {
  fail(`/openapi.json fetch failed: ${e.message}`);
}

// 2) /docs — must be 200 HTML containing a Swagger UI marker
try {
  const r = await fetch(`${base}/docs`, { redirect: "manual" });
  if (r.status !== 200) fail(`/docs status ${r.status} (expected 200)`);
  else pass(`/docs status 200`);
  const html = await r.text();
  if (!/swagger-ui|redoc|openapi/i.test(html)) {
    fail(`/docs body missing swagger-ui/redoc marker (first 120 chars: ${html.slice(0, 120)})`);
  } else {
    pass(`/docs renders API docs shell`);
  }
} catch (e) {
  fail(`/docs fetch failed: ${e.message}`);
}

// 3) /v1/health — must be 200 in the target environment
try {
  const r = await fetch(`${base}/v1/health`, { redirect: "manual" });
  if (r.status !== 200) fail(`/v1/health status ${r.status} (expected 200)`);
  else pass(`/v1/health status 200`);
} catch (e) {
  fail(`/v1/health fetch failed: ${e.message}`);
}

if (failed) {
  console.error(`\nPost-deploy spec-version check FAILED for ${env}.`);
  process.exit(1);
}
console.log(`\nPost-deploy spec-version check passed for ${env} (v${expected}).`);
