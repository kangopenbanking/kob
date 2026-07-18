#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI2 — Deterministic representative fixture loader.
//
// Populates the four Gateway tables with synthetic, seeded rows across eight
// merchants (and two tenants where the schema supports them) with duplicate
// timestamps, so query-plan capture can select the approved composite
// indexes. No personal, customer, production, or copied staging data.
//
// R1I-d.2A-CI2 §6 corrections:
//   * Deterministic UUIDv4-compatible identifiers (crypto-safe format).
//   * `information_schema.columns` preflight: any required non-null column
//     without a default that the loader does not populate causes a
//     LOUD FIXTURE_MISSING_REQUIRED_COLUMN error — never silent inserts.
//   * Best-effort defaults for common gateway columns (status, currency,
//     tenant_id, slug) computed deterministically per row.
//
// Idempotent inside a freshly-reset disposable database: the loader begins
// with TRUNCATE of the four Gateway tables and rolls back on any error.

import { createHash } from "node:crypto";
import { runGuard } from "./guard.mjs";

const TABLES = [
  "gateway_subaccounts",
  "gateway_beneficiaries",
  "gateway_payment_links",
  "gateway_virtual_accounts",
];
const MERCHANTS = 8;
const TENANTS = 2;
const ROWS_PER_MERCHANT = Number(process.env.D2A_FIXTURE_ROWS || 500);
const DUPLICATE_TS_EVERY = 25;

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
}

/**
 * Deterministic UUIDv4-compatible identifier. Uses SHA-256 over a domain
 * seed so identical inputs across runs yield identical UUIDs. Sets the
 * version (4) and variant (RFC 4122) bits correctly.
 */
export function deterministicUuidV4(seed) {
  const h = createHash("sha256").update(String(seed)).digest();
  const bytes = Buffer.from(h.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Deterministic slug for payment links. */
export function deterministicSlug(seed) {
  return "pl_" + createHash("sha256").update(String(seed)).digest("hex").slice(0, 20);
}

/**
 * Introspect information_schema.columns for the target table and return a
 * list of required (NOT NULL, no default, no identity) columns the loader
 * MUST populate. Standard timestamps we set explicitly are excluded.
 */
export async function requiredColumns(client, table, schema = "public") {
  const { rows } = await client.query(
    `SELECT column_name, data_type, is_nullable, column_default,
            is_identity, identity_generation
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return rows
    .filter((r) =>
      r.is_nullable === "NO" &&
      r.column_default === null &&
      r.is_identity !== "YES"
    )
    .map((r) => r.column_name);
}

/**
 * Best-effort values for common gateway columns. The exact populated set is
 * validated against `requiredColumns` before insert; any unmet requirement
 * aborts loudly.
 */
function rowValues({ table, merchantIdx, rowIdx, baseTs }) {
  const stamp = baseTs + (rowIdx - (rowIdx % DUPLICATE_TS_EVERY)) * 60_000;
  const iso = new Date(stamp).toISOString();
  const merchantId = deterministicUuidV4(`d2a-merchant-${merchantIdx}`);
  const tenantId = deterministicUuidV4(`d2a-tenant-${merchantIdx % TENANTS}`);
  const id = deterministicUuidV4(`d2a-${table}-${merchantIdx}-${rowIdx}`);
  return {
    id,
    merchant_id: merchantId,
    tenant_id: tenantId,
    created_at: iso,
    updated_at: iso,
    status: "active",
    currency: "XAF",
    name: `Fixture ${table} ${merchantIdx}/${rowIdx}`,
    slug: deterministicSlug(`d2a-${table}-${merchantIdx}-${rowIdx}`),
    amount: 100 + (rowIdx % 900),
    reference: `ref_${merchantIdx}_${rowIdx}`,
    account_number: `ACC${String(merchantIdx).padStart(4, "0")}${String(rowIdx).padStart(8, "0")}`,
    bank_code: "CM001",
    country_code: "CM",
    email: `merchant${merchantIdx}+row${rowIdx}@fixture.d2a.local`,
    phone: `+2376${String(10000000 + rowIdx).padStart(8, "0")}`,
    metadata: JSON.stringify({ fixture: "d2a", merchantIdx, rowIdx }),
    is_active: true,
  };
}

runGuard();

const pg = (await import("pg")).default;
const client = new pg.Client({ connectionString: process.env.D2A_HARNESS_PGURL });
await client.connect();

try {
  await client.query("BEGIN");
  for (const table of TABLES) {
    await client.query(`TRUNCATE public.${table} CASCADE`);
  }

  const baseTs = new Date("2026-01-01T00:00:00Z").getTime();
  const summary = { tables: {}, merchants: MERCHANTS, rowsPerMerchant: ROWS_PER_MERCHANT };

  for (const table of TABLES) {
    const required = await requiredColumns(client, table);
    const sample = rowValues({ table, merchantIdx: 0, rowIdx: 0, baseTs });
    const providedKeys = new Set(Object.keys(sample));
    const missing = required.filter((c) => !providedKeys.has(c));
    if (missing.length > 0) {
      log("FIXTURE_MISSING_REQUIRED_COLUMN", { table, missing, required });
      throw new Error(
        `Fixture cannot satisfy required columns ${missing.join(", ")} on ${table}`,
      );
    }
    // Compute the intersection of provided keys and actual table columns.
    const { rows: actualCols } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    const actualSet = new Set(actualCols.map((r) => r.column_name));
    const insertCols = [...providedKeys].filter((c) => actualSet.has(c));

    let inserted = 0;
    for (let m = 0; m < MERCHANTS; m += 1) {
      const values = [];
      const params = [];
      for (let r = 0; r < ROWS_PER_MERCHANT; r += 1) {
        const row = rowValues({ table, merchantIdx: m, rowIdx: r, baseTs });
        const rowParams = insertCols.map((c) => row[c]);
        const startIdx = params.length + 1;
        params.push(...rowParams);
        const placeholders = insertCols.map((_, i) => `$${startIdx + i}`).join(",");
        values.push(`(${placeholders})`);
      }
      await client.query(
        `INSERT INTO public.${table} (${insertCols.join(",")}) VALUES ${values.join(",")}`,
        params,
      );
      inserted += ROWS_PER_MERCHANT;
    }
    const { rows } = await client.query(`SELECT count(*)::int AS c FROM public.${table}`);
    summary.tables[table] = { inserted, total: rows[0].c, columns: insertCols };
    log("fixture_loaded", { table, inserted, total: rows[0].c, columns: insertCols });
  }
  await client.query("COMMIT");
  log("fixture_ok", summary);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  log("fixture_error", { message: String(err.message || err) });
  process.exit(1);
} finally {
  await client.end();
}
