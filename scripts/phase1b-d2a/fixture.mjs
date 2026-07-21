#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3 — Deterministic representative fixture loader.
//
// CI3 corrections vs CI2:
//   §CI3-A  Inserts PARENT `gateway_merchants` rows BEFORE any child rows so
//           the NOT-NULL FK `merchant_id REFERENCES gateway_merchants(id)`
//           constraint on the four child tables is satisfied.
//   §CI3-B  Replaces the single generic row builder with FOUR table-specific
//           builders, each populating only columns that exist on the target
//           table. Required-column preflight is per-table.
//
// Guarantees:
//   * Deterministic UUIDv4 identifiers (crypto-safe format).
//   * `information_schema.columns` preflight — any required non-null column
//     without a default that the corresponding builder does not populate
//     causes a LOUD FIXTURE_MISSING_REQUIRED_COLUMN error (fixture aborts).
//   * All work runs inside a single transaction. Any failure rolls back.
//   * Never touches production; requires the disposable-environment guard.

import { createHash } from "node:crypto";
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
  return deterministicUuidV4(`d2a-user-${idx}`);
}

function isoAt(rowIdx) {
  const stamp = BASE_TS + (rowIdx - (rowIdx % DUPLICATE_TS_EVERY)) * 60_000;
  return new Date(stamp).toISOString();
}

// ─── Per-table builders (§CI3-B) ─────────────────────────────────────────────

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
    created_at: iso,
    updated_at: iso,
  };
}

export function buildSubaccount({ merchantIdx, rowIdx }) {
  const iso = isoAt(rowIdx);
  return {
    id: deterministicUuidV4(`d2a-gateway_subaccounts-${merchantIdx}-${rowIdx}`),
    merchant_id: merchantIdFor(merchantIdx),
    name: `Subaccount ${merchantIdx}/${rowIdx}`,
    status: "active",
    currency: "XAF",
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
    account_number: `ACC${String(merchantIdx).padStart(4, "0")}${String(rowIdx).padStart(8, "0")}`,
    bank_code: "CM001",
    currency: "XAF",
    status: "active",
    created_at: iso,
    updated_at: iso,
  };
}

export function buildPaymentLink({ merchantIdx, rowIdx }) {
  const iso = isoAt(rowIdx);
  return {
    id: deterministicUuidV4(`d2a-gateway_payment_links-${merchantIdx}-${rowIdx}`),
    merchant_id: merchantIdFor(merchantIdx),
    slug: deterministicSlug(`d2a-gateway_payment_links-${merchantIdx}-${rowIdx}`),
    title: `Payment Link ${merchantIdx}/${rowIdx}`,
    amount: 100 + (rowIdx % 900),
    currency: "XAF",
    status: "active",
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
    bank_code: "CM001",
    currency: "XAF",
    status: "active",
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

async function loadParents(client, coverage) {
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
  for (let m = 0; m < MERCHANTS; m += 1) rows.push(buildParentMerchant(m));
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
  };

  try {
    await client.query("BEGIN");
    // §CI3-A — TRUNCATE children first (cascade removes children of the parent
    // rows too), then TRUNCATE parents, then insert parents BEFORE children.
    for (const table of CHILD_TABLES) {
      await client.query(`TRUNCATE public.${table} CASCADE`);
    }
    await client.query(`TRUNCATE public.${PARENT_TABLE} CASCADE`);

    const parent = await loadParents(client, coverage);
    summary.parent = parent;
    log("parent_loaded", { table: PARENT_TABLE, ...parent });

    for (const table of CHILD_TABLES) {
      const builder = BUILDERS[table];
      const result = await loadTable(client, table, builder, coverage);
      const { rows } = await client.query(`SELECT count(*)::int AS c FROM public.${table}`);
      summary.tables[table] = { ...result, total: rows[0].c };
      log("fixture_loaded", { table, ...result, total: rows[0].c });
    }

    // FK sanity: every child.merchant_id must map to a parent.
    let orphanCount = 0;
    for (const table of CHILD_TABLES) {
      const { rows } = await client.query(
        `SELECT count(*)::int AS c
           FROM public.${table} c
           LEFT JOIN public.${PARENT_TABLE} p ON p.id = c.merchant_id
          WHERE p.id IS NULL`,
      );
      if (rows[0].c > 0) orphanCount += rows[0].c;
    }
    summary.parentForeignKeyFixtureCoverage = orphanCount === 0 ? "PASS" : "FAIL";
    const coveredCount = CHILD_TABLES.filter((t) => coverage[t]?.covered).length;
    summary.fixtureRequiredColumnCoverage = `${coveredCount}/${CHILD_TABLES.length}`;
    summary.coverage = coverage;

    await client.query("COMMIT");
    writeFileSync("fixture-summary.json", JSON.stringify(summary, null, 2));
    log("fixture_ok", {
      fixtureRequiredColumnCoverage: summary.fixtureRequiredColumnCoverage,
      parentForeignKeyFixtureCoverage: summary.parentForeignKeyFixtureCoverage,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    writeFileSync("fixture-summary.json", JSON.stringify({ error: String(err.message || err), coverage }, null, 2));
    log("fixture_error", { message: String(err.message || err) });
    process.exit(1);
  } finally {
    await client.end();
  }
}

const isCli = import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith("fixture.mjs"));
if (isCli) {
  main().catch((err) => {
    log("fixture_fatal", { message: String(err.message || err) });
    process.exit(1);
  });
}
