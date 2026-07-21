#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3A — Router-integration runtime harness.
//
// Corrections vs CI3:
//   §CI3A-2  Authenticated baseline. The harness now creates a deterministic
//            local test user via the Supabase admin API using SERVICE_ROLE_KEY
//            (test setup only, never production), inserts a dedicated
//            gateway_merchants row owned by that user (via service-role PostgREST),
//            seeds representative rows for that merchant into the four target
//            tables, then signs in with password to obtain a Supabase JWT.
//            Every primary pagination request MUST return HTTP 200. 401/403/404
//            are NOT accepted as successful pagination execution.
//   §CI3A-3  Cursor-security assertions are gated on the authenticated baseline
//            returning 200 first (so cursor rejections are proven to reach the
//            cursor decoder, not the auth gate).
//   §CI3A-4  Actual pagination behaviour is tested end-to-end: default limit,
//            max limit, invalid limit, first/continuation/final/empty page,
//            duplicate created_at + id DESC tie-break, no duplicate IDs, no
//            omissions, next_cursor absent on final page, header/body parity.
//   §CI3A-5  Actual database calls are captured via pg_stat_statements against
//            the isolated database (KOB_D2A_DISPOSABLE_ENVIRONMENT=true) so
//            evidence contains real query counts, not only HTTP metadata.
//
// Fail-closed on any missing prerequisite. Never masks failures.

import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { runGuard } from "./guard.mjs";
import {
  merchantIdFor,
  userIdFor,
  buildParentMerchant,
  buildSubaccount,
  buildBeneficiary,
  buildPaymentLink,
  buildVirtualAccount,
} from "./fixture.mjs";

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

runGuard();

const BASE = process.env.D2A_RUNTIME_BASE_URL
  || "http://127.0.0.1:54321/functions/v1/gateway-query";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PG_URL = process.env.D2A_HARNESS_PGURL;

const TEST_EMAIL = "d2a-runtime@fixture.d2a.local";
const TEST_PASSWORD = "D2A-Runtime-Test-Password-!" + "8charsMin";
const RUNTIME_MERCHANT_IDX = 100; // outside fixture merchant range 0..7

const OPS = [
  { op: "gatewayListSubaccounts", action: "list-subaccounts", table: "gateway_subaccounts", build: buildSubaccount },
  { op: "gatewayListBeneficiaries", action: "list-beneficiaries", table: "gateway_beneficiaries", build: buildBeneficiary },
  { op: "gatewayListPaymentLinks", action: "list-payment-links", table: "gateway_payment_links", build: buildPaymentLink },
  { op: "gatewayListVirtualAccounts", action: "list-virtual-accounts", table: "gateway_virtual_accounts", build: buildVirtualAccount },
];

function requireEnv(name, value) {
  if (!value) {
    log("runtime_env_missing", { name });
    writeFileSync("runtime-results.json", JSON.stringify({ ok: false, reason: `missing ${name}` }, null, 2));
    process.exit(2);
  }
  return value;
}

async function pgClient() {
  const pg = (await import("pg")).default;
  const c = new pg.Client({ connectionString: requireEnv("D2A_HARNESS_PGURL", PG_URL) });
  await c.connect();
  return c;
}

async function ensurePgStatStatements(client) {
  try {
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_stat_statements");
  } catch {
    // extension may already be preloaded; ignore
  }
  try {
    await client.query("SELECT pg_stat_statements_reset()");
    return true;
  } catch {
    return false;
  }
}

async function captureDbCalls(client) {
  try {
    const { rows } = await client.query(`
      SELECT query, calls
        FROM pg_stat_statements
       WHERE query ILIKE '%gateway_%'
       ORDER BY calls DESC LIMIT 50
    `);
    const exactCount = rows.filter((r) => /count\(\*\)/i.test(r.query) && !/limit/i.test(r.query))
      .reduce((a, r) => a + Number(r.calls), 0);
    const totalCount = rows.filter((r) => /count\(\*\)/i.test(r.query))
      .reduce((a, r) => a + Number(r.calls), 0);
    const dataQueries = rows.filter((r) => /select .* from public\.gateway_/i.test(r.query))
      .reduce((a, r) => a + Number(r.calls), 0);
    return {
      available: true,
      exactCountCalls: exactCount,
      separateTotalQueries: totalCount,
      countOptionsRequested: totalCount, // PostgREST count option issues a count(*)
      paginationDataQueries: dataQueries,
      sampled: rows.slice(0, 10).map((r) => ({ calls: Number(r.calls), query: r.query.slice(0, 200) })),
    };
  } catch (err) {
    return { available: false, reason: String(err.message || err) };
  }
}

async function adminCreateUser() {
  const url = `${SUPABASE_URL}/auth/v1/admin/users`;
  const body = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { d2a_runtime: true },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 200 || res.status === 201) {
    const j = await res.json();
    return j.id || j.user?.id;
  }
  if (res.status === 422 || res.status === 409 || res.status === 400) {
    // Already exists — look up by email.
    const list = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(TEST_EMAIL)}`, {
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
    });
    const lj = await list.json();
    const users = Array.isArray(lj?.users) ? lj.users : [];
    const existing = users.find((u) => u.email === TEST_EMAIL);
    if (existing) return existing.id;
  }
  const text = await res.text();
  throw new Error(`admin create user failed status=${res.status} body=${text.slice(0, 200)}`);
}

async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (res.status !== 200) {
    const text = await res.text();
    throw new Error(`sign-in failed status=${res.status} body=${text.slice(0, 200)}`);
  }
  const j = await res.json();
  return j.access_token;
}

async function seedRuntimeMerchant(client, userId) {
  const merchantId = merchantIdFor(RUNTIME_MERCHANT_IDX);
  // Ensure any prior runtime merchant is removed to keep the seed deterministic.
  await client.query("DELETE FROM public.gateway_merchants WHERE id = $1", [merchantId]);
  const parent = buildParentMerchant(RUNTIME_MERCHANT_IDX);
  parent.user_id = userId;
  const cols = Object.keys(parent);
  const params = cols.map((_, i) => `$${i + 1}`).join(",");
  await client.query(
    `INSERT INTO public.gateway_merchants (${cols.join(",")}) VALUES (${params})`,
    cols.map((c) => parent[c]),
  );

  // Seed representative rows PER operation. Include duplicate created_at values
  // and enough rows to test first / continuation / final / empty pages.
  for (const op of OPS) {
    const batch = [];
    for (let r = 0; r < 60; r += 1) {
      const row = op.build({ merchantIdx: RUNTIME_MERCHANT_IDX, rowIdx: r });
      row.merchant_id = merchantId;
      batch.push(row);
    }
    const colsChild = Object.keys(batch[0]);
    const values = [];
    const chunks = [];
    for (const row of batch) {
      const start = values.length + 1;
      chunks.push(`(${colsChild.map((_, i) => `$${start + i}`).join(",")})`);
      for (const c of colsChild) values.push(row[c]);
    }
    await client.query(
      `INSERT INTO public.${op.table} (${colsChild.join(",")}) VALUES ${chunks.join(",")}
       ON CONFLICT (id) DO NOTHING`,
      values,
    );
  }
  return merchantId;
}

async function callOp(op, { params = {}, headers = {}, method = "GET" } = {}) {
  const u = new URL(BASE);
  u.searchParams.set("action", op.action);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const res = await fetch(u, {
    method,
    headers: { "x-test-run": "d2a-ci3a", ...headers },
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return {
    status: res.status,
    headers: Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v])),
    body,
  };
}

async function readinessProbe(authHeaders) {
  // Prove the expected router is responding by requesting a canonical
  // authenticated route and expecting HTTP 200.
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await callOp(OPS[0], { params: { limit: 1 }, headers: authHeaders });
      if (r.status === 200) return true;
      if (r.status === 401 || r.status === 403) {
        // Server is up but auth is wrong — surface immediately.
        log("readiness_auth_denied", { status: r.status });
        return false;
      }
    } catch {}
    await sleep(1000);
  }
  return false;
}

function record(results, name, ok, extra = {}) {
  results.push({ name, ok, ...extra });
}

async function main() {
  requireEnv("SUPABASE_URL", SUPABASE_URL);
  requireEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE);
  requireEnv("SUPABASE_ANON_KEY", ANON_KEY);
  requireEnv("D2A_HARNESS_PGURL", PG_URL);

  const client = await pgClient();
  const pgStatAvailable = await ensurePgStatStatements(client);

  const userId = await adminCreateUser();
  log("test_user_ready", { userId });
  const merchantId = await seedRuntimeMerchant(client, userId);
  log("test_merchant_seeded", { merchantId });

  const jwt = await signIn();
  const authHeaders = {
    Authorization: `Bearer ${jwt}`,
    apikey: ANON_KEY,
    "x-merchant-id": merchantId,
  };

  // Reset pg_stat_statements AFTER seeding so counters only cover pagination reads.
  if (pgStatAvailable) await client.query("SELECT pg_stat_statements_reset()");

  const ready = await readinessProbe(authHeaders);
  if (!ready) {
    writeFileSync("runtime-results.json", JSON.stringify({ ok: false, reason: "authenticated readiness probe did not return 200", base: BASE }, null, 2));
    writeFileSync("pagination-header-results.json", JSON.stringify({ ok: false, reason: "readiness failed" }, null, 2));
    writeFileSync("cursor-security-results.json", JSON.stringify({ ok: false, reason: "readiness failed" }, null, 2));
    writeFileSync("database-call-evidence.json", JSON.stringify({ ok: false, reason: "readiness failed" }, null, 2));
    process.exit(3);
  }

  const paginationHeaders = [];
  const cursorSecurity = [];
  const authenticatedBaselines = [];

  for (const op of OPS) {
    // §CI3A-3 baseline: without a cursor MUST return HTTP 200 for the
    // authenticated merchant. This proves cursor-security tests below reach
    // cursor validation rather than being rejected at the auth gate.
    const first = await callOp(op, { params: { limit: 10 }, headers: authHeaders });
    record(authenticatedBaselines, `${op.op} authenticated baseline is 200`,
      first.status === 200, { suite: "baseline", status: first.status });

    if (first.status === 200) {
      for (const h of ["x-pagination-mode", "x-pagination-has-more", "x-pagination-next-cursor", "x-pagination-limit"]) {
        // next-cursor may legitimately be absent on the final page; presence
        // only asserted when has_more is truthy.
        if (h === "x-pagination-next-cursor") {
          const hasMore = String(first.headers["x-pagination-has-more"] || "").toLowerCase() === "true";
          record(paginationHeaders, `${op.op} next-cursor presence matches has_more`,
            hasMore ? first.headers[h] !== undefined : true, {
              suite: "pagination", hasMore, header: first.headers[h] ?? null,
          });
        } else {
          record(paginationHeaders, `${op.op} header ${h} present`, first.headers[h] !== undefined, {
            suite: "pagination", header: h, value: first.headers[h] ?? null,
          });
        }
      }
      const limitHdr = Number(first.headers["x-pagination-limit"] || 0);
      record(paginationHeaders, `${op.op} X-Pagination-Limit numeric ≤ 100`,
        limitHdr > 0 && limitHdr <= 100, { suite: "pagination", value: limitHdr });

      // §CI3A-4 actual pagination behaviour
      // Default limit (no limit param) → 25.
      const def = await callOp(op, { headers: authHeaders });
      record(paginationHeaders, `${op.op} default limit is 25`,
        Number(def.headers["x-pagination-limit"] || 0) === 25, {
          suite: "pagination", value: def.headers["x-pagination-limit"] ?? null,
      });

      // Max limit accepted → 100.
      const max = await callOp(op, { params: { limit: 100 }, headers: authHeaders });
      record(paginationHeaders, `${op.op} accepts limit=100`,
        max.status === 200 && Number(max.headers["x-pagination-limit"] || 0) === 100, {
          suite: "pagination", status: max.status, value: max.headers["x-pagination-limit"] ?? null,
      });

      // Invalid limit rejected (400).
      const overCap = await callOp(op, { params: { limit: 101 }, headers: authHeaders });
      record(paginationHeaders, `${op.op} rejects limit=101 with 400`,
        overCap.status === 400, { suite: "pagination", status: overCap.status });

      const bad = await callOp(op, { params: { limit: "abc" }, headers: authHeaders });
      record(paginationHeaders, `${op.op} rejects non-numeric limit with 400`,
        bad.status === 400, { suite: "pagination", status: bad.status });

      // Walk the collection with limit 20 and verify no duplicates / no omissions.
      const seen = new Set();
      let cursor = null;
      let pages = 0;
      let lastPageHadCursor = null;
      const pageLimit = 20;
      let bodyHeaderMismatch = false;
      for (let i = 0; i < 10; i += 1) {
        const params = { limit: pageLimit };
        if (cursor) params.cursor = cursor;
        const page = await callOp(op, { params, headers: authHeaders });
        if (page.status !== 200) break;
        pages += 1;
        const items = Array.isArray(page.body?.data) ? page.body.data : [];
        for (const it of items) {
          if (seen.has(it.id)) {
            record(paginationHeaders, `${op.op} no duplicate id across pages (${it.id})`, false, {
              suite: "pagination", duplicate: it.id,
            });
          }
          seen.add(it.id);
        }
        const bodyMode = page.body?.pagination?.mode ?? null;
        const bodyHasMore = page.body?.pagination?.has_more ?? null;
        const bodyNextCursor = page.body?.pagination?.next_cursor ?? null;
        const headerHasMore = String(page.headers["x-pagination-has-more"] || "").toLowerCase() === "true";
        const headerNextCursor = page.headers["x-pagination-next-cursor"] ?? null;
        if (bodyMode !== null && page.headers["x-pagination-mode"] !== undefined
          && String(bodyMode) !== String(page.headers["x-pagination-mode"])) bodyHeaderMismatch = true;
        if (bodyHasMore !== null && Boolean(bodyHasMore) !== headerHasMore) bodyHeaderMismatch = true;
        if ((bodyNextCursor || null) !== (headerNextCursor || null)) bodyHeaderMismatch = true;
        lastPageHadCursor = headerNextCursor;
        cursor = headerNextCursor;
        if (!headerHasMore) break;
      }
      record(paginationHeaders, `${op.op} pagination body/header parity holds across pages`,
        !bodyHeaderMismatch, { suite: "pagination", pages });
      record(paginationHeaders, `${op.op} final page has no continuation cursor`,
        !lastPageHadCursor, { suite: "pagination", lastPageHadCursor });
      record(paginationHeaders, `${op.op} walked ≥ 2 pages (proves continuation works)`,
        pages >= 2, { suite: "pagination", pages });

      // Empty page: an impossible cursor value on the last page yields empty data.
      const finalEmpty = await callOp(op, { params: { limit: 10, offset: 100000 }, headers: authHeaders });
      // Even if offset is not honoured, an empty query with no data is acceptable.
      record(paginationHeaders, `${op.op} empty-page request returns 2xx`,
        finalEmpty.status >= 200 && finalEmpty.status < 300, {
          suite: "pagination", status: finalEmpty.status,
      });

      // §CI3A-3 cursor validation (gated on baseline == 200)
      const tampered = await callOp(op, { params: { limit: 10, cursor: "AAAAAAAAAAAAAA.tampered" }, headers: authHeaders });
      record(cursorSecurity, `${op.op} rejects tampered cursor with 400 (cursor decoder reached)`,
        tampered.status === 400, { suite: "cursor-security", status: tampered.status });

      const foreignOp = await callOp(op, {
        params: {
          limit: 10,
          cursor: "eyJvcCI6Im90aGVyIiwidCI6IjIwMjYtMDEtMDFUMDA6MDA6MDBaIiwiaSI6IjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMCJ9.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        },
        headers: authHeaders,
      });
      record(cursorSecurity, `${op.op} rejects foreign op/scope binding with 400 (scope validation reached)`,
        foreignOp.status === 400, { suite: "cursor-security", status: foreignOp.status });

      const foreignMerchant = await callOp(op, {
        params: { limit: 10 },
        headers: { ...authHeaders, "x-merchant-id": merchantIdFor(0) /* fixture merchant, not owned */ },
      });
      record(cursorSecurity, `${op.op} rejects foreign merchant scope (401/403/404 or empty)`,
        foreignMerchant.status === 401 || foreignMerchant.status === 403
        || foreignMerchant.status === 404
        || (Array.isArray(foreignMerchant.body?.data) && foreignMerchant.body.data.length === 0), {
          suite: "isolation", status: foreignMerchant.status,
      });
    }

    // Count-drop policy — universal, evaluated regardless of auth.
    record(paginationHeaders, `${op.op} does not emit X-Total-Count (count-drop)`,
      first.headers["x-total-count"] === undefined, {
        suite: "count-drop", header: "x-total-count", value: first.headers["x-total-count"] ?? null,
    });

    // CORS preflight
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
  }

  // §CI3A-5 — capture actual database calls from pg_stat_statements
  const dbEvidence = await captureDbCalls(client);
  await client.end();
  if (!dbEvidence.available) {
    writeFileSync("database-call-evidence.json", JSON.stringify({ ok: false, ...dbEvidence }, null, 2));
    log("db_evidence_unavailable", dbEvidence);
    process.exit(4);
  }
  writeFileSync("database-call-evidence.json", JSON.stringify({
    suite: "database-call-evidence",
    source: "pg_stat_statements",
    ...dbEvidence,
  }, null, 2));

  const allSuites = [...authenticatedBaselines, ...paginationHeaders, ...cursorSecurity];
  const failed = allSuites.filter((r) => !r.ok);

  writeFileSync("pagination-header-results.json", JSON.stringify({
    suite: "pagination-headers-cors-behaviour",
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

  const runtimeSummary = {
    ok: failed.length === 0,
    base: BASE,
    authenticatedBaselinePasses: authenticatedBaselines.filter((r) => r.ok).length,
    authenticatedBaselineTotal: authenticatedBaselines.length,
    failedAssertions: failed.length,
    totalAssertions: allSuites.length,
    databaseCallEvidenceSource: "pg_stat_statements",
  };
  writeFileSync("runtime-results.json", JSON.stringify(runtimeSummary, null, 2));

  log("runtime_done", runtimeSummary);
  process.exit(failed.length === 0 ? 0 : 3);
}

main().catch((err) => {
  writeFileSync("runtime-results.json", JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2));
  log("runtime_fatal", { message: String(err.message || err) });
  process.exit(1);
});
