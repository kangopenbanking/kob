#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI11 — Auth-parented representative fixture.
//
// Corrections vs CI3A:
//   §CI11-1  gateway_merchants inserts trigger public.trg_assign_merchant_role,
//            which writes into public.user_roles whose user_id has a real
//            foreign key to auth.users(id). The fixture must therefore create
//            disposable local Auth users through the Supabase Auth Admin API
//            BEFORE inserting merchants, and map the actual returned Auth IDs
//            onto the fixture merchant rows.
//
// Guarantees:
//   * Never touches auth.users via direct SQL.
//   * Never disables triggers, constraints, or session_replication_role.
//   * Requires the fully-attested local Supabase stack (via runGuard()).
//   * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (local stack only).
//   * Deterministic UUIDs, slugs, and merchant IDs are preserved.
//   * Only the inserted merchant row's user_id is overridden with the real
//     Auth Admin user ID for that merchant index.
//   * No secrets, passwords, keys, tokens, or Auth user IDs are written to
//     fixture-summary.json or logged.

import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { runGuard } from "./guard.mjs";

const CHILD_TABLES = [
  "gateway_subaccounts",
  "gateway_beneficiaries",
  "gateway_payment_links",
  "gateway_virtual_accounts",
];
const PARENT_TABLE = "gateway_merchants";
const MERCHANTS = 8;
const TENANTS = 2;
const ROWS_PER_MERCHANT = Number(process.env.D2A_FIXTURE_ROWS || 500);
const DUPLICATE_TS_EVERY = 25;
const BASE_TS = new Date("2026-01-01T00:00:00Z").getTime();

// Deterministic fixture email prefix. Never expose the returned Auth IDs.
const FIXTURE_EMAIL_DOMAIN = "fixture.d2a.local";
const FIXTURE_EMAIL_PREFIX = "d2a-fixture-merchant-";

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

export function deterministicUuidV4(seed) {
  const h = createHash("sha256").update(String(seed)).digest();
  const bytes = Buffer.from(h.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function deterministicSlug(seed) {
  return "pl_" + createHash("sha256").update(String(seed)).digest("hex").slice(0, 20);
}

export function merchantIdFor(idx) {
  return deterministicUuidV4(`d2a-merchant-${idx}`);
}
export function tenantIdFor(idx) {
  return deterministicUuidV4(`d2a-tenant-${idx % TENANTS}`);
}
export function userIdFor(idx) {
  // Retained for CI3 static test parity. Real merchant user_id at insert time
  // is overridden with the Auth Admin API user ID (see loadParents()).
  return deterministicUuidV4(`d2a-user-${idx}`);
}

export function fixtureEmailFor(idx) {
  return `${FIXTURE_EMAIL_PREFIX}${idx}@${FIXTURE_EMAIL_DOMAIN}`;
}

function isoAt(rowIdx) {
  const stamp = BASE_TS + (rowIdx - (rowIdx % DUPLICATE_TS_EVERY)) * 60_000;
  return new Date(stamp).toISOString();
}

// ─── Per-table builders (unchanged deterministic behaviour) ─────────────────

export function buildParentMerchant(merchantIdx) {
  const iso = new Date(BASE_TS).toISOString();
  return {
    id: merchantIdFor(merchantIdx),
    user_id: userIdFor(merchantIdx),
    business_name: `D2A Fixture Merchant ${merchantIdx}`,
    business_email: `merchant${merchantIdx}@fixture.d2a.local`,
    status: "active",
    kyb_status: "approved",
    environment: "sandbox",
    fee_bearer: "merchant",
    api_keys_count: 0,
    plan_tier: "free",
    settlement_frequency: "daily",
    live_mode_enabled: false,
    created_at: iso,
    updated_at: iso,
  };
}

export function buildSubaccount({ merchantIdx, rowIdx }) {
  const iso = isoAt(rowIdx);
  const splitValue = (rowIdx % 100) + 1;
  return {
    id: deterministicUuidV4(`d2a-gateway_subaccounts-${merchantIdx}-${rowIdx}`),
    merchant_id: merchantIdFor(merchantIdx),
    subaccount_name: `Subaccount ${merchantIdx}/${rowIdx}`,
    split_type: "percentage",
    split_value: splitValue,
    currency: "XAF",
    is_active: true,
    created_at: iso,
    updated_at: iso,
  };
}

export function buildBeneficiary({ merchantIdx, rowIdx }) {
  const iso = isoAt(rowIdx);
  return {
    id: deterministicUuidV4(`d2a-gateway_beneficiaries-${merchantIdx}-${rowIdx}`),
    merchant_id: merchantIdFor(merchantIdx),
    name: `Beneficiary ${merchantIdx}/${rowIdx}`,
    channel: "mobile_money",
    account_number: `ACC${String(merchantIdx).padStart(4, "0")}${String(rowIdx).padStart(8, "0")}`,
    is_active: true,
    created_at: iso,
    updated_at: iso,
  };
}

export function buildPaymentLink({ merchantIdx, rowIdx }) {
  const iso = isoAt(rowIdx);
  return {
    id: deterministicUuidV4(`d2a-gateway_payment_links-${merchantIdx}-${rowIdx}`),
    merchant_id: merchantIdFor(merchantIdx),
    title: `Payment Link ${merchantIdx}/${rowIdx}`,
    amount: 100 + (rowIdx % 900),
    currency: "XAF",
    status: "active",
    slug: deterministicSlug(`d2a-gateway_payment_links-${merchantIdx}-${rowIdx}`),
    use_count: 0,
    created_at: iso,
    updated_at: iso,
  };
}

export function buildVirtualAccount({ merchantIdx, rowIdx }) {
  const iso = isoAt(rowIdx);
  return {
    id: deterministicUuidV4(`d2a-gateway_virtual_accounts-${merchantIdx}-${rowIdx}`),
    merchant_id: merchantIdFor(merchantIdx),
    account_number: `VA${String(merchantIdx).padStart(4, "0")}${String(rowIdx).padStart(10, "0")}`,
    bank_name: "KOB Sandbox Bank",
    status: "active",
    currency: "XAF",
    created_at: iso,
    updated_at: iso,
  };
}

const BUILDERS = {
  gateway_subaccounts: buildSubaccount,
  gateway_beneficiaries: buildBeneficiary,
  gateway_payment_links: buildPaymentLink,
  gateway_virtual_accounts: buildVirtualAccount,
};

// ─── Auth Admin API helpers (local disposable Supabase stack only) ──────────

function redactSummary(text) {
  if (!text) return "";
  const flat = String(text).replace(/\s+/g, " ").trim();
  return flat.length > 200 ? flat.slice(0, 200) : flat;
}

async function authAdminFetch(path, init) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("FIXTURE_MISSING_SUPABASE_URL");
  if (!key) throw new Error("FIXTURE_MISSING_SUPABASE_SERVICE_ROLE_KEY");
  const url = `${base.replace(/\/+$/, "")}/auth/v1/admin/users${path}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(init?.headers || {}),
  };
  return fetch(url, { ...init, headers });
}

async function locateExistingUserByEmail(email) {
  // GoTrue admin list supports filter by email.
  const params = new URLSearchParams({ email });
  const res = await authAdminFetch(`?${params.toString()}`, { method: "GET" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `AUTH_ADMIN_LIST_UNEXPECTED status=${res.status} summary=${redactSummary(body)}`,
    );
  }
  const data = await res.json().catch(() => ({}));
  const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
  const match = users.find((u) => (u?.email || "").toLowerCase() === email.toLowerCase());
  return match?.id || null;
}

async function ensureFixtureAuthUsers() {
  const results = [];
  let created = 0;
  let reused = 0;
  for (let m = 0; m < MERCHANTS; m += 1) {
    const email = fixtureEmailFor(m);
    // Strong deterministic-per-run but non-persisted password. Never logged.
    const password = randomBytes(24).toString("hex");
    const body = {
      email,
      password,
      email_confirm: true,
      user_metadata: { d2a_fixture: true, merchant_index: m },
    };
    const res = await authAdminFetch("", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.status === 200 || res.status === 201) {
      const data = await res.json().catch(() => ({}));
      const id = data?.id || data?.user?.id;
      if (!id) {
        throw new Error(
          `AUTH_ADMIN_CREATE_NO_ID merchantIndex=${m} status=${res.status}`,
        );
      }
      results.push({ index: m, id, reused: false });
      created += 1;
      continue;
    }
    // Narrow existing-user handling.
    if (res.status === 400 || res.status === 409 || res.status === 422) {
      const existing = await locateExistingUserByEmail(email);
      if (!existing) {
        const summary = redactSummary(await res.text().catch(() => ""));
        throw new Error(
          `AUTH_ADMIN_EXISTING_USER_NOT_FOUND merchantIndex=${m} status=${res.status} summary=${summary}`,
        );
      }
      results.push({ index: m, id: existing, reused: true });
      reused += 1;
      continue;
    }
    const summary = redactSummary(await res.text().catch(() => ""));
    // Fail closed for any other status. Never leak the request headers or URL.
    throw new Error(
      `AUTH_ADMIN_UNEXPECTED_STATUS merchantIndex=${m} status=${res.status} summary=${summary}`,
    );
  }
  return { users: results, created, reused };
}

// ─── Schema helpers ──────────────────────────────────────────────────────────

export async function requiredColumns(client, table, schema = "public") {
  const { rows } = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
        AND is_nullable = 'NO' AND column_default IS NULL
        AND (is_identity IS NULL OR is_identity <> 'YES')`,
    [schema, table],
  );
  return rows.map((r) => r.column_name);
}

async function tableColumns(client, table, schema = "public") {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return new Set(rows.map((r) => r.column_name));
}

async function bulkInsert(client, table, columns, rows) {
  if (rows.length === 0) return 0;
  const params = [];
  const chunks = [];
  for (const row of rows) {
    const start = params.length + 1;
    const placeholders = columns.map((_, i) => `$${start + i}`).join(",");
    chunks.push(`(${placeholders})`);
    for (const c of columns) params.push(row[c]);
  }
  await client.query(
    `INSERT INTO public.${table} (${columns.join(",")}) VALUES ${chunks.join(",")}`,
    params,
  );
  return rows.length;
}

async function loadTable(client, table, builder, coverage) {
  const required = await requiredColumns(client, table);
  const actual = await tableColumns(client, table);
  const sample = builder({ merchantIdx: 0, rowIdx: 0 });
  const provided = new Set(Object.keys(sample));
  const missing = required.filter((c) => !provided.has(c));
  const covered = required.length === 0 || missing.length === 0;
  coverage[table] = { required, missing, covered };
  if (!covered) {
    log("FIXTURE_MISSING_REQUIRED_COLUMN", { table, missing, required });
    throw new Error(
      `Fixture cannot satisfy required columns ${missing.join(", ")} on ${table}`,
    );
  }
  const insertCols = [...provided].filter((c) => actual.has(c));

  let inserted = 0;
  for (let m = 0; m < MERCHANTS; m += 1) {
    const batch = [];
    for (let r = 0; r < ROWS_PER_MERCHANT; r += 1) {
      batch.push(builder({ merchantIdx: m, rowIdx: r }));
    }
    inserted += await bulkInsert(client, table, insertCols, batch);
  }
  return { inserted, columns: insertCols };
}

async function loadParents(client, coverage, authUsers) {
  const required = await requiredColumns(client, PARENT_TABLE);
  const actual = await tableColumns(client, PARENT_TABLE);
  const sample = buildParentMerchant(0);
  const provided = new Set(Object.keys(sample));
  const missing = required.filter((c) => !provided.has(c));
  coverage[PARENT_TABLE] = { required, missing, covered: missing.length === 0 };
  if (missing.length > 0) {
    log("FIXTURE_MISSING_REQUIRED_COLUMN", { table: PARENT_TABLE, missing, required });
    throw new Error(
      `Fixture cannot satisfy required columns ${missing.join(", ")} on ${PARENT_TABLE}`,
    );
  }
  const insertCols = [...provided].filter((c) => actual.has(c));
  const rows = [];
  for (let m = 0; m < MERCHANTS; m += 1) {
    const merchant = buildParentMerchant(m);
    const authUser = authUsers.find((u) => u.index === m);
    if (!authUser) {
      throw new Error(`FIXTURE_MISSING_AUTH_USER merchantIndex=${m}`);
    }
    // §CI11-2 override only the merchant user_id with the real Auth Admin ID.
    merchant.user_id = authUser.id;
    rows.push(merchant);
  }
  const inserted = await bulkInsert(client, PARENT_TABLE, insertCols, rows);
  return { inserted, columns: insertCols };
}

async function main() {
  runGuard();

  const pg = (await import("pg")).default;
  const client = new pg.Client({ connectionString: process.env.D2A_HARNESS_PGURL });
  await client.connect();

  const coverage = {};
  const summary = {
    merchants: MERCHANTS,
    tenants: TENANTS,
    rowsPerMerchant: ROWS_PER_MERCHANT,
    parent: null,
    tables: {},
    fixtureRequiredColumnCoverage: null,
    parentForeignKeyFixtureCoverage: null,
    authUsers: {
      requested: MERCHANTS,
      created: 0,
      reused: 0,
      resolved: 0,
    },
    authUserParentCoverage: null,
    merchantRoleTriggerCoverage: null,
    duplicateMerchantRoles: null,
  };

  const merchantIds = [];
  for (let m = 0; m < MERCHANTS; m += 1) merchantIds.push(merchantIdFor(m));

  try {
    // §CI11-1 Create or resolve disposable local Auth users BEFORE any DB work.
    const { users, created, reused } = await ensureFixtureAuthUsers();
    summary.authUsers.created = created;
    summary.authUsers.reused = reused;
    summary.authUsers.resolved = users.length;
    if (users.length !== MERCHANTS) {
      throw new Error(
        `AUTH_ADMIN_RESOLVE_COUNT_MISMATCH expected=${MERCHANTS} actual=${users.length}`,
      );
    }
    log("auth_users_ready", {
      requested: MERCHANTS,
      created,
      reused,
      resolved: users.length,
    });

    await client.query("BEGIN");
    for (const table of CHILD_TABLES) {
      await client.query(`TRUNCATE public.${table} CASCADE`);
    }
    await client.query(`TRUNCATE public.${PARENT_TABLE} CASCADE`);

    const parent = await loadParents(client, coverage, users);
    summary.parent = parent;
    log("parent_loaded", { table: PARENT_TABLE, ...parent });

    // §CI11-3 Post-parent validation: Auth-parent coverage.
    const { rows: apRows } = await client.query(
      `SELECT count(*)::int AS c
         FROM public.gateway_merchants gm
         JOIN auth.users au ON au.id = gm.user_id
        WHERE gm.id = ANY($1::uuid[])`,
      [merchantIds],
    );
    const authParentCount = apRows[0].c;
    summary.authUserParentCoverage = authParentCount === MERCHANTS ? "PASS" : "FAIL";
    if (authParentCount !== MERCHANTS) {
      throw new Error(
        `AUTH_USER_PARENT_COVERAGE_FAIL expected=${MERCHANTS} actual=${authParentCount}`,
      );
    }

    // §CI11-3 Merchant-role trigger coverage (canonical trigger created row).
    const { rows: mrRows } = await client.query(
      `SELECT count(*)::int AS c
         FROM public.gateway_merchants gm
         JOIN public.user_roles ur
           ON ur.user_id = gm.user_id
          AND ur.role = 'merchant'
        WHERE gm.id = ANY($1::uuid[])`,
      [merchantIds],
    );
    const merchantRoleCount = mrRows[0].c;
    summary.merchantRoleTriggerCoverage =
      merchantRoleCount === MERCHANTS ? "PASS" : "FAIL";
    if (merchantRoleCount !== MERCHANTS) {
      throw new Error(
        `MERCHANT_ROLE_TRIGGER_COVERAGE_FAIL expected=${MERCHANTS} actual=${merchantRoleCount}`,
      );
    }

    // Duplicate merchant-role rows for fixture users.
    const { rows: dupRows } = await client.query(
      `SELECT count(*)::int AS c FROM (
         SELECT ur.user_id
           FROM public.user_roles ur
           JOIN public.gateway_merchants gm ON gm.user_id = ur.user_id
          WHERE gm.id = ANY($1::uuid[]) AND ur.role = 'merchant'
          GROUP BY ur.user_id HAVING count(*) > 1
       ) dup`,
      [merchantIds],
    );
    summary.duplicateMerchantRoles = dupRows[0].c;
    if (dupRows[0].c !== 0) {
      throw new Error(`DUPLICATE_MERCHANT_ROLES count=${dupRows[0].c}`);
    }

    for (const table of CHILD_TABLES) {
      const builder = BUILDERS[table];
      const result = await loadTable(client, table, builder, coverage);
      const { rows } = await client.query(`SELECT count(*)::int AS c FROM public.${table}`);
      summary.tables[table] = { ...result, total: rows[0].c };
      log("fixture_loaded", { table, ...result, total: rows[0].c });
    }

    let orphans = 0;
    for (const table of CHILD_TABLES) {
      const { rows } = await client.query(
        `SELECT count(*)::int AS c
           FROM public.${table} c
           LEFT JOIN public.${PARENT_TABLE} p ON p.id = c.merchant_id
          WHERE p.id IS NULL`,
      );
      orphans += rows[0].c;
    }
    summary.parentForeignKeyFixtureCoverage = orphans === 0 ? "PASS" : "FAIL";
    summary.fixtureRequiredColumnCoverage =
      Object.values(coverage).every((c) => c.covered) ? "PASS" : "FAIL";
    if (orphans > 0) throw new Error(`FK orphans detected: ${orphans}`);
    await client.query("COMMIT");
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore rollback errors */ }
    const evidence = {
      error: String(err?.message || err),
      errorCode: err?.code || null,
      errorConstraint: err?.constraint || null,
      errorTable: err?.table || null,
    };
    log("fixture_failed", evidence);
    writeFileSync(
      "fixture-summary.json",
      JSON.stringify({ ...summary, ...evidence }, null, 2),
    );
    process.exit(1);
  } finally {
    await client.end();
  }

  writeFileSync("fixture-summary.json", JSON.stringify({ ...summary, coverage }, null, 2));
  log("fixture_ok", {
    fixtureRequiredColumnCoverage: summary.fixtureRequiredColumnCoverage,
    parentForeignKeyFixtureCoverage: summary.parentForeignKeyFixtureCoverage,
    authUserParentCoverage: summary.authUserParentCoverage,
    merchantRoleTriggerCoverage: summary.merchantRoleTriggerCoverage,
    duplicateMerchantRoles: summary.duplicateMerchantRoles,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    log("fixture_fatal", { message: String(err.message || err) });
    process.exit(1);
  });
}
