#!/usr/bin/env node
/**
 * Kora preflight — validates that all required Kora secrets are configured
 * and that the Kora endpoint is reachable before running issuing E2E tests.
 *
 * Usage: node scripts/kora-preflight.mjs
 * Exits non-zero on failure.
 */
const REQUIRED = ["KORA_SECRET_KEY", "KORA_PUBLIC_KEY", "KORA_WEBHOOK_SECRET"];
const BASE = process.env.KORA_BASE_URL || "https://api.korapay.com/merchant/api/v1";

let ok = true;
for (const k of REQUIRED) {
  if (!process.env[k]) { console.error(`MISSING ${k}`); ok = false; }
  else console.log(`OK      ${k} (len=${process.env[k].length})`);
}

if (!ok) process.exit(1);

try {
  const t0 = Date.now();
  const res = await fetch(BASE.replace(/\/+$/, "") + "/", {
    method: "GET",
    headers: { Authorization: `Bearer ${process.env.KORA_SECRET_KEY}` },
  });
  console.log(`OK      reachable status=${res.status} latency=${Date.now() - t0}ms`);
  if (res.status >= 500) process.exit(2);
} catch (e) {
  console.error(`FAIL    network: ${e.message}`);
  process.exit(2);
}
console.log("Kora preflight passed.");
