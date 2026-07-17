#!/usr/bin/env node
// Phase 1B — R1I-d.2A-INFRA — EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) capture.
//
// Runs before/after query-plan capture for each of the four d.2A operations,
// asserting that the approved composite index is chosen. No planner hints,
// no forced index selection, no fabricated numbers — the script reports
// whatever the planner actually chose.

import { runGuard } from "./guard.mjs";

const OPS = [
  { name: "gatewayListSubaccounts", table: "gateway_subaccounts", index: "idx_gw_subaccounts_merchant_created_id_desc" },
  { name: "gatewayListBeneficiaries", table: "gateway_beneficiaries", index: "idx_gw_beneficiaries_merchant_created_id_desc" },
  { name: "gatewayListPaymentLinks", table: "gateway_payment_links", index: "idx_gw_payment_links_merchant_created_id_desc" },
  { name: "gatewayListVirtualAccounts", table: "gateway_virtual_accounts", index: "idx_gw_virtual_accounts_merchant_created_id_desc" },
];

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

runGuard();

const pg = (await import("pg")).default;
const client = new pg.Client({ connectionString: process.env.D2A_HARNESS_PGURL });
await client.connect();

const merchantId = "00000000-0000-4000-8000-000000000003";
try {
  for (const op of OPS) {
    const q = `SELECT id, created_at FROM public.${op.table}
               WHERE merchant_id = $1
               ORDER BY created_at DESC, id DESC
               LIMIT 50`;
    const res = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q}`,
      [merchantId],
    );
    const plan = res.rows[0]["QUERY PLAN"];
    const planText = JSON.stringify(plan);
    const usesIndex = planText.includes(op.index);
    log("query_plan", { op: op.name, index: op.index, usesIndex, plan });
    if (!usesIndex) process.exitCode = 2;
  }
} finally {
  await client.end();
}
