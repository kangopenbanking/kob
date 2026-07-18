#!/usr/bin/env node
// Phase 1B — R1I-d.2A-DB1 — Online concurrent-index harness (local only).
//
// Executes the online CONCURRENTLY forward and rollback scripts against a
// dedicated ISOLATED LOCAL PostgreSQL database over a direct autocommit
// session. NEVER runs against production. NEVER embeds credentials.
//
// Required environment (must be pointed at a scratch local database):
//   D2A_HARNESS_PGURL   postgres://user:pass@127.0.0.1:5432/scratch_db
//
// Refuses to run when D2A_HARNESS_PGURL is unset, points at a non-local host,
// or when the URL contains a transaction-pooler port (6543).
//
// This harness only performs steps §8 of the R1I-d.2A-DB1 authorisation:
// it does not create/populate fixture data (that is §9) and does not run
// EXPLAIN captures (§10). Those are separate scripts.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FWD = resolve(
  ROOT,
  "supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql",
);
const RBK = resolve(
  ROOT,
  "supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.rollback.sql",
);

const APPROVED = [
  {
    op: "gatewayListSubaccounts",
    schema: "public",
    table: "gateway_subaccounts",
    index: "idx_gw_subaccounts_merchant_created_id_desc",
    def: "CREATE INDEX idx_gw_subaccounts_merchant_created_id_desc ON public.gateway_subaccounts USING btree (merchant_id, created_at DESC, id DESC)",
  },
  {
    op: "gatewayListBeneficiaries",
    schema: "public",
    table: "gateway_beneficiaries",
    index: "idx_gw_beneficiaries_merchant_created_id_desc",
    def: "CREATE INDEX idx_gw_beneficiaries_merchant_created_id_desc ON public.gateway_beneficiaries USING btree (merchant_id, created_at DESC, id DESC)",
  },
  {
    op: "gatewayListPaymentLinks",
    schema: "public",
    table: "gateway_payment_links",
    index: "idx_gw_payment_links_merchant_created_id_desc",
    def: "CREATE INDEX idx_gw_payment_links_merchant_created_id_desc ON public.gateway_payment_links USING btree (merchant_id, created_at DESC, id DESC)",
  },
  {
    op: "gatewayListVirtualAccounts",
    schema: "public",
    table: "gateway_virtual_accounts",
    index: "idx_gw_virtual_accounts_merchant_created_id_desc",
    def: "CREATE INDEX idx_gw_virtual_accounts_merchant_created_id_desc ON public.gateway_virtual_accounts USING btree (merchant_id, created_at DESC, id DESC)",
  },
];

function refuseIfNotLocal(url) {
  const u = new URL(url);
  const host = u.hostname;
  const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!localHosts.has(host)) {
    throw new Error(
      `D2A_HARNESS_PGURL host must be local (got ${host}). Production connections are refused.`,
    );
  }
  if (u.port === "6543") {
    throw new Error(
      "D2A_HARNESS_PGURL must NOT use port 6543 (transaction pooler). CREATE INDEX CONCURRENTLY requires a direct session on 5432.",
    );
  }
}

function normalise(sqlDef) {
  return sqlDef.replace(/\s+/g, " ").trim();
}

/**
 * Comment-safe parser for the tightly-scoped d.2A CONCURRENTLY artifacts
 * (R1I-d.2A-CI2 §5). The previous splitter dropped any semicolon-delimited
 * chunk whose first non-whitespace characters were `--`, which discarded
 * every valid statement in these files because they are all preceded by
 * numbered comments.
 *
 * Steps:
 *   1. Strip complete `-- …` line comments (whole-line and trailing).
 *   2. Split on semicolons.
 *   3. Trim, collapse whitespace, drop empty statements.
 *   4. Every forward statement MUST start with `CREATE INDEX CONCURRENTLY`.
 *      Every rollback statement MUST start with `DROP INDEX CONCURRENTLY`.
 *      Anything else fails closed.
 *   5. Exactly four statements are expected.
 */
export function parseConcurrentStatements(text, kind /* "forward" | "rollback" */) {
  if (kind !== "forward" && kind !== "rollback") {
    throw new Error(`parseConcurrentStatements: invalid kind ${kind}`);
  }
  const stripped = text
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf("--");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");

  const stmts = stripped
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length > 0);

  const expectedPrefix = kind === "forward"
    ? /^CREATE INDEX CONCURRENTLY\b/i
    : /^DROP INDEX CONCURRENTLY\b/i;

  for (const stmt of stmts) {
    if (!expectedPrefix.test(stmt)) {
      throw new Error(
        `parseConcurrentStatements: unexpected ${kind} statement rejected: ${stmt.slice(0, 80)}`,
      );
    }
  }

  if (stmts.length !== 4) {
    throw new Error(
      `parseConcurrentStatements: expected exactly 4 ${kind} statements, got ${stmts.length}`,
    );
  }
  return stmts;
}

async function splitConcurrentStatements(text, kind = "forward") {
  return parseConcurrentStatements(text, kind);
}

async function assertNoActiveTx(client) {
  const { rows } = await client.query("SHOW transaction_isolation");
  if (!rows.length) throw new Error("cannot introspect transaction state");
  // pg's default client runs in autocommit unless BEGIN issued.
}

async function inspect(client, entry) {
  const { rows } = await client.query(
    `SELECT c.relname AS indexname,
            i.indisvalid,
            i.indisready,
            pg_get_indexdef(i.indexrelid) AS indexdef
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = $2`,
    [entry.schema, entry.index],
  );
  if (rows.length === 0) return { present: false };
  const [r] = rows;
  return {
    present: true,
    valid: r.indisvalid,
    ready: r.indisready,
    definitionOk: normalise(r.indexdef) === normalise(entry.def),
    actualDef: r.indexdef,
  };
}

async function runForward(client) {
  const stmts = await splitConcurrentStatements(readFileSync(FWD, "utf8"), "forward");
  for (const stmt of stmts) {
    // Each CONCURRENTLY statement executes on its own in autocommit.
    await client.query(stmt);
  }
}

async function runRollback(client) {
  const stmts = await splitConcurrentStatements(readFileSync(RBK, "utf8"), "rollback");
  for (const stmt of stmts) {
    await client.query(stmt);
  }
}

async function main() {
  const url = process.env.D2A_HARNESS_PGURL;
  if (!url) {
    console.error(
      "D2A_HARNESS_PGURL is not set. Point it at a scratch LOCAL Postgres instance (port 5432). Refusing to run.",
    );
    process.exit(2);
  }
  refuseIfNotLocal(url);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await assertNoActiveTx(client);

    console.log("[d.2A-DB1] pre-state:");
    for (const e of APPROVED) console.log("  ", e.index, await inspect(client, e));

    console.log("[d.2A-DB1] running forward CONCURRENTLY script…");
    await runForward(client);

    let allOk = true;
    for (const e of APPROVED) {
      const s = await inspect(client, e);
      const ok = s.present && s.valid && s.ready && s.definitionOk;
      console.log("  ", e.index, s);
      if (!ok) allOk = false;
    }
    if (!allOk) throw new Error("post-forward index verification failed");

    console.log("[d.2A-DB1] rerun (should be idempotent)…");
    await runForward(client);

    console.log("[d.2A-DB1] rollback…");
    await runRollback(client);
    for (const e of APPROVED) {
      const s = await inspect(client, e);
      if (s.present) throw new Error(`rollback failed to drop ${e.index}`);
    }

    console.log("[d.2A-DB1] reapply after rollback…");
    await runForward(client);

    console.log("[d.2A-DB1] PASS");
  } finally {
    await client.end();
  }
}

// CLI guard — the parser is import-safe; only run main() when invoked directly.
const isCli = import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith("slice-d2a-online-index-harness.mjs"));
if (isCli) {
  main().catch((err) => {
    console.error("[d.2A-DB1] FAIL:", err.message);
    process.exit(1);
  });
}
