#!/usr/bin/env node
// Phase 1B — R1I-d.2A-INFRA — Router-integration test entrypoint.
//
// Boots the Deno-based Gateway Edge Function locally (if the Supabase CLI is
// present) and invokes the four canonical routes through the router — not
// through direct adapter imports. Direct-adapter unit tests remain in
// src/test/pagination-gateway-d2a-contract.test.ts and are additive.
//
// This entrypoint intentionally does NOT synthesise runtime numbers when the
// runtime is unavailable; it exits non-zero so the calling workflow records
// the absence honestly.

import { spawnSync, spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { runGuard } from "./guard.mjs";

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

runGuard();

const which = spawnSync(process.platform === "win32" ? "where" : "which", ["supabase"], { encoding: "utf8" });
if (which.status !== 0) {
  log("supabase_cli_missing", { note: "Supabase CLI required to boot Edge runtime." });
  process.exit(2);
}

const serve = spawn("supabase", ["functions", "serve", "gateway-query", "--no-verify-jwt"], {
  stdio: "inherit",
  env: { ...process.env },
});

await sleep(4000);

const OPS = [
  "gatewayListSubaccounts",
  "gatewayListBeneficiaries",
  "gatewayListPaymentLinks",
  "gatewayListVirtualAccounts",
];

let failed = 0;
try {
  for (const op of OPS) {
    const url = `http://127.0.0.1:54321/functions/v1/gateway-query?op=${op}&limit=10`;
    const res = await fetch(url, { headers: { "x-test-run": "d2a-infra" } });
    const body = await res.text();
    const pag = {
      total: res.headers.get("x-pagination-total"),
      hasMore: res.headers.get("x-pagination-has-more"),
      nextCursor: res.headers.get("x-pagination-next-cursor"),
    };
    log("runtime_probe", { op, status: res.status, pagination: pag, bytes: body.length });
    if (res.status !== 200) failed += 1;
  }
} finally {
  serve.kill("SIGTERM");
}
process.exit(failed === 0 ? 0 : 3);
