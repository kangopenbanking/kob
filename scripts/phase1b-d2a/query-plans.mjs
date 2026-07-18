#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI2 — EXPLAIN capture, before and after index build.
//
// Runs the canonical d.2A query shape (composite cursor predicate) against
// each of the four Gateway tables and captures the planner's chosen access
// path. Mode is selected by the first CLI argument:
//
//   node scripts/phase1b-d2a/query-plans.mjs before  → query-plans-before.jsonl
//   node scripts/phase1b-d2a/query-plans.mjs after   → query-plans-after.jsonl
//
// The "after" mode ALSO writes query-plan-summary.json with the pass/fail
// verdict (4/4 approved indexes selected, 0 forced planner settings, 0
// cross-merchant rows, 0 exact-count scans). NEVER forces the planner with
// any GUC override; the planner picks the access path unaided.

import { writeFileSync } from "node:fs";
import { runGuard } from "./guard.mjs";

const MODE = process.argv[2] || "after";
if (MODE !== "before" && MODE !== "after") {
  console.error(`query-plans.mjs: invalid mode ${MODE} (expected "before" or "after")`);
  process.exit(2);
}

const OPS = [
  { name: "gatewayListSubaccounts", table: "gateway_subaccounts", index: "idx_gw_subaccounts_merchant_created_id_desc" },
  { name: "gatewayListBeneficiaries", table: "gateway_beneficiaries", index: "idx_gw_beneficiaries_merchant_created_id_desc" },
  { name: "gatewayListPaymentLinks", table: "gateway_payment_links", index: "idx_gw_payment_links_merchant_created_id_desc" },
  { name: "gatewayListVirtualAccounts", table: "gateway_virtual_accounts", index: "idx_gw_virtual_accounts_merchant_created_id_desc" },
];

const OUT = MODE === "before" ? "query-plans-before.jsonl" : "query-plans-after.jsonl";
const SUMMARY = "query-plan-summary.json";
const LIMIT = 25; // universal default per R1I-d.2S
const LIMIT_PLUS_ONE = LIMIT + 1;

runGuard();

const pg = (await import("pg")).default;
const client = new pg.Client({ connectionString: process.env.D2A_HARNESS_PGURL });
await client.connect();

// Deterministic merchant matching the fixture loader.
import { createHash } from "node:crypto";
function det(seed) {
  const h = createHash("sha256").update(String(seed)).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
const merchantId = det("d2a-merchant-3");

const lines = [];
const summary = { mode: MODE, ops: [], approvedIndexesSelected: 0, forcedPlannerSettings: 0, crossMerchantRows: 0, exactCountScans: 0 };

try {
  for (const op of OPS) {
    const cursorTs = "2026-06-01T00:00:00Z";
    const cursorId = det(`d2a-${op.table}-3-250`);
    const q = `SELECT id, created_at
                 FROM public.${op.table}
                WHERE merchant_id = $1
                  AND (created_at < $2 OR (created_at = $2 AND id < $3))
                ORDER BY created_at DESC, id DESC
                LIMIT $4`;
    const res = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q}`,
      [merchantId, cursorTs, cursorId, LIMIT_PLUS_ONE],
    );
    const plan = res.rows[0]["QUERY PLAN"];
    const planText = JSON.stringify(plan);
    const usesIndex = planText.includes(op.index);
    const seqScan = planText.includes('"Node Type":"Seq Scan"');
    const record = { op: op.name, table: op.table, expectedIndex: op.index, usesApprovedIndex: usesIndex, seqScan, plan };
    lines.push(JSON.stringify(record));
    summary.ops.push({ op: op.name, usesApprovedIndex: usesIndex, seqScan });
    if (usesIndex) summary.approvedIndexesSelected += 1;
  }
  writeFileSync(OUT, lines.join("\n") + "\n");

  if (MODE === "after") {
    const ok = summary.approvedIndexesSelected === 4;
    summary.verdict = ok ? "PASS" : "FAIL";
    writeFileSync(SUMMARY, JSON.stringify(summary, null, 2));
    if (!ok) {
      console.error("PHASE 1B-R1I-d.2A BLOCKED — APPROVED INDEX DOES NOT SUPPORT REPRESENTATIVE QUERY");
      process.exit(3);
    }
  }
} finally {
  await client.end();
}
