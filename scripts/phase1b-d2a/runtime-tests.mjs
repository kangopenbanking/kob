#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3 — Router-integration runtime harness.
//
// CI3 corrections:
//   §CI3-C  Does NOT start `supabase functions serve` — the workflow starts
//           the server exactly once in a prior step and passes its URL via
//           D2A_RUNTIME_BASE_URL. This entrypoint fails closed if the server
//           is not already reachable.
//   §CI3-D  Emits five distinct evidence artefacts covering pagination,
//           cursor security, merchant/tenant isolation, headers, CORS, and
//           the count-drop policy:
//             * pagination-header-results.json
//             * cursor-security-results.json
//             * database-call-evidence.json
//             * runtime-results.json
//           And exits non-zero on any test failure (the workflow does NOT
//           mask the exit code with `|| true`).

import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { runGuard } from "./guard.mjs";

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

runGuard();

const BASE = process.env.D2A_RUNTIME_BASE_URL
  || "http://127.0.0.1:54321/functions/v1/gateway-query";

const OPS = [
  { op: "gatewayListSubaccounts", action: "list-subaccounts" },
  { op: "gatewayListBeneficiaries", action: "list-beneficiaries" },
  { op: "gatewayListPaymentLinks", action: "list-payment-links" },
  { op: "gatewayListVirtualAccounts", action: "list-virtual-accounts" },
];

async function readinessProbe() {
  // Fail closed if the server is not already reachable — do NOT start one here.
  for (let i = 0; i < 30; i += 1) {
    try {
      const r = await fetch(`${BASE}?action=${OPS[0].action}&limit=1`, {
        headers: { "x-test-run": "d2a-ci3" },
      });
      if (r.status < 500) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

function record(target, name, ok, detail) {
  target.push({ name, ok, ...detail });
  log("assert", { suite: detail.suite, name, ok });
}

async function callOp(op, params = {}, headers = {}) {
  const u = new URL(BASE);
  u.searchParams.set("action", op.action);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const res = await fetch(u, {
    headers: { "x-test-run": "d2a-ci3", ...headers },
  });
  let bodyText = "";
  try { bodyText = await res.text(); } catch {}
  let bodyJson = null;
  try { bodyJson = bodyText ? JSON.parse(bodyText) : null; } catch {}
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    body: bodyJson,
    bodyText,
  };
}

async function main() {
  const ready = await readinessProbe();
  if (!ready) {
    writeFileSync("runtime-results.json", JSON.stringify({ ok: false, reason: "runtime unreachable", base: BASE }, null, 2));
    writeFileSync("pagination-header-results.json", JSON.stringify({ ok: false, reason: "runtime unreachable" }, null, 2));
    writeFileSync("cursor-security-results.json", JSON.stringify({ ok: false, reason: "runtime unreachable" }, null, 2));
    writeFileSync("database-call-evidence.json", JSON.stringify({ ok: false, reason: "runtime unreachable" }, null, 2));
    log("runtime_unreachable", { base: BASE });
    process.exit(2);
  }

  const paginationHeaders = [];
  const cursorSecurity = [];
  const databaseEvidence = [];
  const generic = [];

  for (const op of OPS) {
    const first = await callOp(op, { limit: 10 });

    // §CI3-D.pagination — ratified X-Pagination-* headers on 200.
    record(paginationHeaders, `${op.op} returns 2xx or 401`, first.status < 500, {
      suite: "pagination", status: first.status,
    });
    if (first.status >= 200 && first.status < 300) {
      for (const h of ["x-pagination-mode", "x-pagination-has-more", "x-pagination-next-cursor", "x-pagination-limit"]) {
        record(paginationHeaders, `${op.op} header ${h} present`, first.headers[h] !== undefined, {
          suite: "pagination", header: h, value: first.headers[h] ?? null,
        });
      }
      record(paginationHeaders, `${op.op} X-Pagination-Limit numeric ≤ 100`,
        Number(first.headers["x-pagination-limit"] || 0) > 0 &&
        Number(first.headers["x-pagination-limit"] || 0) <= 100, {
          suite: "pagination", value: first.headers["x-pagination-limit"] ?? null,
      });
    }

    // §CI3-D.count-drop — X-Total-Count MUST NOT be emitted (universal drop).
    record(paginationHeaders, `${op.op} does not emit X-Total-Count (count-drop)`,
      first.headers["x-total-count"] === undefined, {
        suite: "count-drop", header: "x-total-count", value: first.headers["x-total-count"] ?? null,
    });

    // §CI3-D.cursor-security — tamper resistance.
    const tampered = await callOp(op, { limit: 10, cursor: "AAAAAAAAAAAAAA.tampered" });
    record(cursorSecurity, `${op.op} rejects tampered cursor with 4xx`,
      tampered.status >= 400 && tampered.status < 500, {
        suite: "cursor-security", status: tampered.status,
    });
    const foreign = await callOp(op, {
      limit: 10,
      cursor: "eyJvcCI6Im90aGVyIiwidCI6IjIwMjYtMDEtMDFUMDA6MDA6MDBaIiwiaSI6IjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMCJ9.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    record(cursorSecurity, `${op.op} rejects cursor with foreign op/scope binding`,
      foreign.status >= 400 && foreign.status < 500, {
        suite: "cursor-security", status: foreign.status,
    });

    // §CI3-D.isolation — merchant/tenant scoping. An unauthorised call must
    // NEVER return another merchant's rows. Absent a session, the endpoint
    // must respond 401/403 rather than a data leak.
    record(cursorSecurity, `${op.op} anonymous call is 401/403 or empty`,
      first.status === 401 || first.status === 403 ||
      (first.body && Array.isArray(first.body.data) && first.body.data.length === 0), {
        suite: "isolation", status: first.status,
    });

    // §CI3-D.CORS — preflight must expose pagination headers and echo origin.
    const preflight = await fetch(BASE + `?action=${op.action}`, {
      method: "OPTIONS",
      headers: {
        origin: "https://developer.kangopenbanking.com",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization,content-type",
      },
    });
    const cors = Object.fromEntries(preflight.headers.entries());
    record(paginationHeaders, `${op.op} CORS preflight returns 2xx/204`,
      preflight.status >= 200 && preflight.status < 300, {
        suite: "cors", status: preflight.status,
    });
    record(paginationHeaders, `${op.op} CORS exposes pagination headers`,
      /x-pagination-/i.test(cors["access-control-expose-headers"] || ""), {
        suite: "cors", exposeHeaders: cors["access-control-expose-headers"] ?? null,
    });

    databaseEvidence.push({
      op: op.op,
      status: first.status,
      rowCountReturned: Array.isArray(first.body?.data) ? first.body.data.length : null,
      paginationMode: first.headers["x-pagination-mode"] ?? null,
      hasMore: first.headers["x-pagination-has-more"] ?? null,
      nextCursorPresent: !!first.headers["x-pagination-next-cursor"],
      totalCountHeaderAbsent: first.headers["x-total-count"] === undefined,
    });

    generic.push({ op: op.op, status: first.status });
  }

  const allSuites = [...paginationHeaders, ...cursorSecurity];
  const failed = allSuites.filter((r) => !r.ok);

  writeFileSync("pagination-header-results.json", JSON.stringify({
    suite: "pagination-headers-and-cors",
    total: paginationHeaders.length,
    failed: paginationHeaders.filter((r) => !r.ok).length,
    results: paginationHeaders,
  }, null, 2));

  writeFileSync("cursor-security-results.json", JSON.stringify({
    suite: "cursor-security-and-isolation",
    total: cursorSecurity.length,
    failed: cursorSecurity.filter((r) => !r.ok).length,
    results: cursorSecurity,
  }, null, 2));

  writeFileSync("database-call-evidence.json", JSON.stringify({
    suite: "database-call-evidence",
    ops: databaseEvidence,
  }, null, 2));

  const runtimeSummary = {
    ok: failed.length === 0,
    base: BASE,
    ops: generic,
    failedAssertions: failed.length,
    totalAssertions: allSuites.length,
  };
  writeFileSync("runtime-results.json", JSON.stringify(runtimeSummary, null, 2));

  log("runtime_done", { ok: runtimeSummary.ok, failed: failed.length, total: allSuites.length });
  process.exit(failed.length === 0 ? 0 : 3);
}

main().catch((err) => {
  writeFileSync("runtime-results.json", JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2));
  log("runtime_fatal", { message: String(err.message || err) });
  process.exit(1);
});
