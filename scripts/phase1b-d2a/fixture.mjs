#!/usr/bin/env node
// Phase 1B — R1I-d.2A-INFRA — Deterministic representative fixture loader.
//
// Populates the four Gateway tables with synthetic, seeded rows across
// multiple merchants and tenants, including duplicate timestamps, so that
// query-plan capture (scripts/phase1b-d2a/query-plans.mjs) can select the
// approved composite indexes. No personal, customer, production, or copied
// staging data.
//
// Idempotent inside a freshly-reset disposable database: the loader begins
// with TRUNCATE of the four Gateway tables and rolls back on any error.

import { runGuard } from "./guard.mjs";

const TABLES = [
  "gateway_subaccounts",
  "gateway_beneficiaries",
  "gateway_payment_links",
  "gateway_virtual_accounts",
];
const MERCHANTS = 8;
const ROWS_PER_MERCHANT = Number(process.env.D2A_FIXTURE_ROWS || 500);
const DUPLICATE_TS_EVERY = 25;

function log(step, payload) {
  process.stdout.write(JSON.stringify({ step, ...payload }) + "\n");
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
  for (const table of TABLES) {
    for (let m = 0; m < MERCHANTS; m += 1) {
      const merchantId = `00000000-0000-4000-8000-${String(m).padStart(12, "0")}`;
      const values = [];
      const params = [];
      for (let r = 0; r < ROWS_PER_MERCHANT; r += 1) {
        const stamp = baseTs + (r - (r % DUPLICATE_TS_EVERY)) * 60_000;
        const iso = new Date(stamp).toISOString();
        const id = `${String(m).padStart(4, "0")}${String(r).padStart(12, "0")}`;
        params.push(id, merchantId, iso);
        const i = params.length;
        values.push(`($${i - 2}, $${i - 1}, $${i})`);
      }
      // INSERT strategy: only id, merchant_id, created_at — the three columns
      // the approved composite index depends on. Other NOT NULL columns are
      // expected to have defaults on the disposable schema; if not, the
      // fixture will fail LOUDLY (no synthesised business data).
      await client.query(
        `INSERT INTO public.${table} (id, merchant_id, created_at) VALUES ${values.join(",")}`,
        params,
      );
    }
    const { rows } = await client.query(`SELECT count(*)::int AS c FROM public.${table}`);
    log("fixture_loaded", { table, rows: rows[0].c });
  }
  await client.query("COMMIT");
  log("fixture_ok", { merchants: MERCHANTS, rowsPerMerchant: ROWS_PER_MERCHANT });
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  log("fixture_error", { message: String(err.message || err) });
  process.exit(1);
} finally {
  await client.end();
}
