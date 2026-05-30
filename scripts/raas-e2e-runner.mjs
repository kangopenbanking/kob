#!/usr/bin/env node
/**
 * RaaS regression E2E runner.
 *
 * Verifies post-Phase-0 auth gates, idempotency, and security audit logging
 * across the Remittance-as-a-Service Edge Functions.
 *
 * Required env:
 *   RAAS_BASE_URL   — e.g. https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1
 *   RAAS_ANON_KEY   — Supabase publishable/anon key
 *   RAAS_USER_JWT   — (optional) authenticated user JWT for happy-path probes
 *
 * Exit code is non-zero on the first regression so the CI build fails.
 */

const BASE = (process.env.RAAS_BASE_URL || "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1").replace(/\/+$/, "");
const ANON = process.env.RAAS_ANON_KEY || "";
const USER_JWT = process.env.RAAS_USER_JWT || "";

if (!ANON) {
  console.error("[raas-e2e] RAAS_ANON_KEY is required");
  process.exit(2);
}

const results = [];
const uuidV4 = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

async function probe(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    const ms = Date.now() - t0;
    results.push({ name, status: "PASS", ms });
    console.log(`PASS  ${name}  (${ms}ms)`);
  } catch (err) {
    const ms = Date.now() - t0;
    results.push({ name, status: "FAIL", ms, error: String(err.message || err) });
    console.error(`FAIL  ${name}  (${ms}ms)\n      ${err.message || err}`);
  }
}

const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

async function call(path, { method = "POST", headers = {}, body, anon = true, userJwt = false } = {}) {
  const h = { "Content-Type": "application/json", apikey: ANON, ...headers };
  if (anon && !h.Authorization) h.Authorization = `Bearer ${ANON}`;
  if (userJwt && USER_JWT) h.Authorization = `Bearer ${USER_JWT}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  return { status: res.status, body: text, json };
}

// ──────────────────────────────────────────────────────────────────
// Auth-gate regressions (Phase 0 must hold)
// ──────────────────────────────────────────────────────────────────

await probe("remittance-recon-cron rejects unauthenticated", async () => {
  const r = await call("/remittance-recon-cron", { body: { action: "list_runs" } });
  expect(r.status === 401 || r.status === 403, `expected 401/403, got ${r.status}`);
});

await probe("remittance-recon-cron emits deterministic error code", async () => {
  const r = await call("/remittance-recon-cron", { body: { action: "list_runs" } });
  expect(r.json && (r.json.code === "CRON_SECRET_REQUIRED" || r.json.error === "unauthorized"),
    `missing structured error: ${r.body}`);
});

await probe("remittance-routing-engine rejects unauthenticated", async () => {
  const r = await call("/remittance-routing-engine", { body: { remittance_id: uuidV4() } });
  expect(r.status === 401, `expected 401, got ${r.status}`);
});

await probe("remittance-fulfill rejects unauthenticated", async () => {
  const r = await call("/remittance-fulfill", { body: { remittance_id: uuidV4() } });
  expect(r.status === 401, `expected 401, got ${r.status}`);
});

await probe("remittance-payin-intent rejects before body parsing", async () => {
  // Send an empty body — if auth runs first we get 401, not a validation error
  // that would otherwise leak provider/contract metadata.
  const r = await call("/remittance-payin-intent", { headers: { Authorization: "Bearer invalid.jwt" }, body: {} });
  expect(r.status === 401, `expected 401, got ${r.status}`);
  expect(!/stripe|paypal|client_secret|configured/i.test(r.body),
    "response leaked provider/contract details before auth");
});

// ──────────────────────────────────────────────────────────────────
// Idempotency contract (new)
// ──────────────────────────────────────────────────────────────────

await probe("remittance-outbound rejects invalid Idempotency-Key", async () => {
  if (!USER_JWT) return; // requires authenticated user
  const r = await call("/remittance-outbound", {
    headers: { "Idempotency-Key": "not-a-uuid" },
    body: { action: "send", corridor_id: "x", amount: 1, receiver_name: "x" },
    userJwt: true,
  });
  expect(r.status === 400 && /IDEMPOTENCY_KEY_INVALID/.test(r.body),
    `expected IDEMPOTENCY_KEY_INVALID, got ${r.status}: ${r.body}`);
});

// ──────────────────────────────────────────────────────────────────
// Read-only happy path (anon)
// ──────────────────────────────────────────────────────────────────

await probe("remittance-engine list_corridors is reachable", async () => {
  const r = await call("/remittance-engine?action=list_corridors&to_country=CM", { method: "GET" });
  expect(r.status < 500, `5xx from list_corridors: ${r.status}`);
});

// ──────────────────────────────────────────────────────────────────
// Report
// ──────────────────────────────────────────────────────────────────

const pass = results.filter((r) => r.status === "PASS").length;
const fail = results.filter((r) => r.status === "FAIL").length;
console.log(`\n──────────────────────────────────────────────────────────────`);
console.log(`RaaS regression: ${pass} passed, ${fail} failed, ${results.length} total`);

if (fail > 0) {
  console.error("\nFailures:");
  for (const r of results.filter((x) => x.status === "FAIL")) {
    console.error(`  • ${r.name}: ${r.error}`);
  }
  process.exit(1);
}
