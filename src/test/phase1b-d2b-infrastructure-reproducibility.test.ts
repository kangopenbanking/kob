/**
 * Phase 1B — R1I-d.2B — Infrastructure reproducibility tests.
 *
 * Verifies the four SQL artifacts and the pending-migrations README against
 * the ratified d.2B contract without touching a database. All checks are
 * structural / textual and run in the ordinary Vitest node environment.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../..");

const CANONICAL = resolve(
  REPO_ROOT,
  "supabase/pending-migrations/phase-1/20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.sql",
);
const CANONICAL_ROLLBACK = resolve(
  REPO_ROOT,
  "supabase/pending-migrations/phase-1/20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.rollback.sql",
);
const CONCURRENT = resolve(
  REPO_ROOT,
  "supabase/pending-operations/phase-1/20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.concurrent.sql",
);
const CONCURRENT_ROLLBACK = resolve(
  REPO_ROOT,
  "supabase/pending-operations/phase-1/20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.concurrent.rollback.sql",
);
const README = resolve(REPO_ROOT, "supabase/pending-migrations/phase-1/README.md");

const EXPECTED_INDEX_NAMES = [
  "idx_gw_customers_merchant_created_id_desc",
  "idx_gw_payment_plans_merchant_created_id_desc",
  "idx_gw_subscriptions_merchant_created_id_desc",
];

const EXPECTED_TABLES = [
  "public.gateway_customers",
  "public.gateway_payment_plans",
  "public.gateway_subscriptions",
];

const D2A_INDEX_NAMES = [
  "idx_gw_subaccounts_merchant_created_id_desc",
  "idx_gw_beneficiaries_merchant_created_id_desc",
  "idx_gw_payment_links_merchant_created_id_desc",
  "idx_gw_virtual_accounts_merchant_created_id_desc",
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Strip SQL `--` line comments so assertions target actual DDL rather than
 * prose in headers. Preserves newlines so line-anchored regexes still work.
 */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("R1I-d.2B — SQL artifact presence", () => {
  it("canonical migration exists at the ratified timestamp", () => {
    expect(existsSync(CANONICAL)).toBe(true);
    expect(CANONICAL).toMatch(/20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes\.sql$/);
  });
  it("canonical rollback exists", () => {
    expect(existsSync(CANONICAL_ROLLBACK)).toBe(true);
  });
  it("concurrent operation exists under pending-operations", () => {
    expect(existsSync(CONCURRENT)).toBe(true);
  });
  it("concurrent rollback exists under pending-operations", () => {
    expect(existsSync(CONCURRENT_ROLLBACK)).toBe(true);
  });
});

describe("R1I-d.2B — canonical SQL structure", () => {
  const sql = read(CANONICAL);

  it("wraps the migration in an explicit BEGIN/COMMIT transaction", () => {
    expect(sql).toMatch(/^\s*(--[^\n]*\n|\s)*BEGIN;/m);
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });
  it("contains exactly three CREATE INDEX statements and no CONCURRENTLY", () => {
    const body = stripComments(sql);
    const createIndex = body.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi) ?? [];
    expect(createIndex.length).toBe(3);
    expect(/CREATE\s+INDEX\s+CONCURRENTLY/i.test(body)).toBe(false);
  });
  it("each approved index name appears with the ratified column order", () => {
    for (const idx of EXPECTED_INDEX_NAMES) {
      const re = new RegExp(
        `CREATE\\s+INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${idx}\\s+ON\\s+public\\.[a-z_]+\\s*\\(merchant_id,\\s*created_at\\s+DESC,\\s*id\\s+DESC\\)`,
        "i",
      );
      expect(re.test(sql), `missing index definition: ${idx}`).toBe(true);
    }
  });
  it("references the three ratified tables and no others", () => {
    for (const t of EXPECTED_TABLES) {
      expect(sql).toContain(t);
    }
    // No d.2A tables leaking into this migration.
    expect(sql).not.toContain("gateway_subaccounts");
    expect(sql).not.toContain("gateway_beneficiaries");
    expect(sql).not.toContain("gateway_payment_links");
    expect(sql).not.toContain("gateway_virtual_accounts");
  });
  it("does NOT create the deferred wider subscriptions composite index", () => {
    expect(/plan_id,\s*status,\s*created_at/i.test(stripComments(sql))).toBe(false);
  });
  it("performs exact-definition verification via pg_temp.d2b_ensure_index", () => {
    expect(sql).toContain("pg_temp.d2b_ensure_index");
    const verifyCalls = sql.match(/SELECT\s+pg_temp\.d2b_ensure_index/gi) ?? [];
    expect(verifyCalls.length).toBe(3);
  });
  it("verification helper enforces indisvalid and indisready", () => {
    expect(sql).toContain("indisvalid");
    expect(sql).toContain("indisready");
  });
  it("contains no schema-mutating verbs (tables, views, triggers, persistent functions, data)", () => {
    expect(/\bDROP\s+TABLE\b/i.test(sql)).toBe(false);
    expect(/\bALTER\s+TABLE\b/i.test(sql)).toBe(false);
    expect(/\bINSERT\s+INTO\b/i.test(sql)).toBe(false);
    expect(/\bUPDATE\s+[a-z_.]+\s+SET\b/i.test(sql)).toBe(false);
    expect(/\bDELETE\s+FROM\b/i.test(sql)).toBe(false);
    expect(/\bTRUNCATE\b/i.test(sql)).toBe(false);
    expect(/\bCREATE\s+TRIGGER\b/i.test(sql)).toBe(false);
    expect(/\bCREATE\s+VIEW\b/i.test(sql)).toBe(false);
    // Persistent CREATE FUNCTION is prohibited; the verification helper lives
    // under pg_temp and is dropped when the transaction ends.
    const persistentFn = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(?!pg_temp\.)/i.test(sql);
    expect(persistentFn).toBe(false);
  });
});

describe("R1I-d.2B — concurrent SQL structure", () => {
  const sql = read(CONCURRENT);

  it("contains exactly three CREATE INDEX CONCURRENTLY statements", () => {
    const stmts = sql.match(/CREATE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS/gi) ?? [];
    expect(stmts.length).toBe(3);
  });
  it("has no transaction wrapper", () => {
    expect(/^\s*BEGIN\s*;/m.test(sql)).toBe(false);
    expect(/^\s*COMMIT\s*;/m.test(sql)).toBe(false);
  });
  it("each approved index name appears with the ratified column order", () => {
    for (const idx of EXPECTED_INDEX_NAMES) {
      const re = new RegExp(
        `CREATE\\s+INDEX\\s+CONCURRENTLY\\s+IF\\s+NOT\\s+EXISTS\\s+${idx}\\s+ON\\s+public\\.[a-z_]+\\s*\\(merchant_id,\\s*created_at\\s+DESC,\\s*id\\s+DESC\\)`,
        "i",
      );
      expect(re.test(sql), `missing concurrent definition: ${idx}`).toBe(true);
    }
  });
  it("does NOT create the deferred wider subscriptions composite index", () => {
    expect(/plan_id,\s*status,\s*created_at/i.test(stripComments(sql))).toBe(false);
  });

  it("has a preflight AND postflight DO block for every approved index", () => {
    for (const idx of EXPECTED_INDEX_NAMES) {
      // Approved index names are literals, not user input; embedding directly.
      const preRe = new RegExp(
        `DO\\s+\\$preflight_[a-z_]+\\$[\\s\\S]*?${idx}[\\s\\S]*?\\$preflight_[a-z_]+\\$`,
        "i",
      );
      const postRe = new RegExp(
        `DO\\s+\\$postflight_[a-z_]+\\$[\\s\\S]*?${idx}[\\s\\S]*?\\$postflight_[a-z_]+\\$`,
        "i",
      );
      expect(preRe.test(sql), `missing preflight DO block for ${idx}`).toBe(true);
      expect(postRe.test(sql), `missing postflight DO block for ${idx}`).toBe(true);
    }
  });

  it("preflight blocks reject definition mismatch, invalid, and not-ready states", () => {
    // Preflight enforcement vocabulary must appear at least once per index.
    const preflightBlocks = sql.match(/\$preflight_[a-z_]+\$[\s\S]*?\$preflight_[a-z_]+\$/gi) ?? [];
    expect(preflightBlocks.length).toBe(EXPECTED_INDEX_NAMES.length);
    for (const block of preflightBlocks) {
      expect(/exists with a different definition/i.test(block)).toBe(true);
      expect(/indisvalid\s*=\s*false/i.test(block)).toBe(true);
      expect(/indisready\s*=\s*false/i.test(block)).toBe(true);
    }
  });

  it("postflight blocks enforce presence, definition match, valid, and ready", () => {
    const postBlocks = sql.match(/\$postflight_[a-z_]+\$[\s\S]*?\$postflight_[a-z_]+\$/gi) ?? [];
    expect(postBlocks.length).toBe(EXPECTED_INDEX_NAMES.length);
    for (const block of postBlocks) {
      expect(/missing after CREATE/i.test(block)).toBe(true);
      expect(/definition mismatch/i.test(block)).toBe(true);
      expect(/indisvalid\s*=\s*false/i.test(block)).toBe(true);
      expect(/indisready\s*=\s*false/i.test(block)).toBe(true);
    }
  });

  /**
   * R2 null-safe catalogue verification. Every preflight and postflight block
   * must:
   *   * assert `IF NOT FOUND` after selecting indisvalid/indisready;
   *   * raise an explicit "catalogue metadata missing" exception;
   *   * evaluate validity/readiness with `IS DISTINCT FROM TRUE` so that both
   *     NULL and FALSE fail closed;
   *   * contain zero remaining `IF NOT v_is_valid` / `IF NOT v_is_ready`
   *     expressions, which are the null-unsafe form.
   */
  it("every pre/postflight block uses null-safe catalogue verification (R2)", () => {
    const allBlocks = sql.match(/\$(?:pre|post)flight_[a-z_]+\$[\s\S]*?\$(?:pre|post)flight_[a-z_]+\$/gi) ?? [];
    expect(allBlocks.length).toBe(EXPECTED_INDEX_NAMES.length * 2);
    for (const block of allBlocks) {
      expect(/IF\s+NOT\s+FOUND\s+THEN/i.test(block)).toBe(true);
      expect(/catalogue metadata missing/i.test(block)).toBe(true);
      expect(/v_is_valid\s+IS\s+DISTINCT\s+FROM\s+TRUE/i.test(block)).toBe(true);
      expect(/v_is_ready\s+IS\s+DISTINCT\s+FROM\s+TRUE/i.test(block)).toBe(true);
      expect(/IF\s+NOT\s+v_is_valid\b/i.test(block)).toBe(false);
      expect(/IF\s+NOT\s+v_is_ready\b/i.test(block)).toBe(false);
    }
  });

  it("file contains zero remaining null-unsafe `IF NOT v_is_valid/ready` forms (R2)", () => {
    expect(sql.match(/IF\s+NOT\s+v_is_valid\b/gi)).toBeNull();
    expect(sql.match(/IF\s+NOT\s+v_is_ready\b/gi)).toBeNull();
  });

  /**
   * Negative mutation guardrail. Simulate an author who reverts null-safe
   * comparisons back to `IF NOT v_is_valid/ready` and prove that the
   * null-safe assertions above would reject the mutated artifact — without
   * touching the on-disk file.
   */
  it("rejects a mutated concurrent SQL that reverts IS DISTINCT FROM TRUE → IF NOT (R2)", () => {
    const mutated = sql
      .replace(/IF\s+v_is_valid\s+IS\s+DISTINCT\s+FROM\s+TRUE\s+THEN/gi, "IF NOT v_is_valid THEN")
      .replace(/IF\s+v_is_ready\s+IS\s+DISTINCT\s+FROM\s+TRUE\s+THEN/gi, "IF NOT v_is_ready THEN");

    // Sanity: mutation actually changed the text.
    expect(mutated).not.toBe(sql);

    // Structural validator must reject the mutated variant.
    const mutatedBlocks = mutated.match(/\$(?:pre|post)flight_[a-z_]+\$[\s\S]*?\$(?:pre|post)flight_[a-z_]+\$/gi) ?? [];
    expect(mutatedBlocks.length).toBe(EXPECTED_INDEX_NAMES.length * 2);
    let nullSafePresent = 0;
    let nullUnsafePresent = 0;
    for (const block of mutatedBlocks) {
      if (/v_is_valid\s+IS\s+DISTINCT\s+FROM\s+TRUE/i.test(block)) nullSafePresent++;
      if (/v_is_ready\s+IS\s+DISTINCT\s+FROM\s+TRUE/i.test(block)) nullSafePresent++;
      if (/IF\s+NOT\s+v_is_valid\b/i.test(block)) nullUnsafePresent++;
      if (/IF\s+NOT\s+v_is_ready\b/i.test(block)) nullUnsafePresent++;
    }
    expect(nullSafePresent).toBe(0);
    expect(nullUnsafePresent).toBe(mutatedBlocks.length * 2);
    expect(mutated.match(/IF\s+NOT\s+v_is_valid\b/gi)?.length).toBe(EXPECTED_INDEX_NAMES.length * 2);
    expect(mutated.match(/IF\s+NOT\s+v_is_ready\b/gi)?.length).toBe(EXPECTED_INDEX_NAMES.length * 2);
  });

  it("rejects a hypothetical concurrent SQL that omits verification blocks", () => {
    // Guardrail: if a future author strips the DO blocks, this suite must fail.
    // We simulate the stripped variant and prove the assertions above would
    // reject it, without mutating the real artifact on disk.
    const stripped = sql.replace(/DO\s+\$(?:pre|post)flight_[a-z_]+\$[\s\S]*?\$(?:pre|post)flight_[a-z_]+\$;?/gi, "");
    for (const idx of EXPECTED_INDEX_NAMES) {
      const preRe = new RegExp(`\\$preflight_[a-z_]+\\$[\\s\\S]*?${idx}`, "i");
      const postRe = new RegExp(`\\$postflight_[a-z_]+\\$[\\s\\S]*?${idx}`, "i");
      expect(preRe.test(stripped)).toBe(false);
      expect(postRe.test(stripped)).toBe(false);
    }
  });
});

describe("R1I-d.2B — canonical/concurrent structural parity", () => {
  function normalise(sql: string): string {
    return sql
      .replace(/CREATE\s+INDEX\s+CONCURRENTLY\s+IF\s+NOT\s+EXISTS/gi, "CREATE INDEX IF NOT EXISTS")
      .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/gi, "CREATE INDEX IF NOT EXISTS")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractDefinitions(sql: string): string[] {
    const re = /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+([a-z_]+)\s+ON\s+(public\.[a-z_]+)\s*\(([^)]+)\)/gi;
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql)) !== null) {
      out.push(`${m[1]} ON ${m[2]} (${m[3].trim().replace(/\s+/g, " ")})`);
    }
    return out.sort();
  }

  it("the three approved index definitions are structurally equivalent between paths", () => {
    const canonicalNorm = normalise(read(CANONICAL));
    const concurrentNorm = normalise(read(CONCURRENT));
    const c1 = extractDefinitions(canonicalNorm);
    const c2 = extractDefinitions(concurrentNorm);
    expect(c1.length).toBe(3);
    expect(c2.length).toBe(3);
    expect(c1).toEqual(c2);
  });
});

describe("R1I-d.2B — rollback SQL structure", () => {
  it("canonical rollback drops only the three approved indexes", () => {
    const sql = read(CANONICAL_ROLLBACK);
    const drops = sql.match(/DROP\s+INDEX\s+IF\s+EXISTS\s+public\.([a-z_]+)/gi) ?? [];
    expect(drops.length).toBe(3);
    for (const idx of EXPECTED_INDEX_NAMES) {
      expect(sql).toContain(idx);
    }
    for (const idx of D2A_INDEX_NAMES) {
      expect(sql).not.toContain(idx);
    }
    expect(/CREATE\s+INDEX/i.test(sql)).toBe(false);
    expect(/DROP\s+TABLE/i.test(sql)).toBe(false);
    expect(/ALTER\s+TABLE/i.test(sql)).toBe(false);
  });

  it("concurrent rollback drops only the three approved indexes with CONCURRENTLY", () => {
    const sql = read(CONCURRENT_ROLLBACK);
    const drops = sql.match(/DROP\s+INDEX\s+CONCURRENTLY\s+IF\s+EXISTS\s+public\.([a-z_]+)/gi) ?? [];
    expect(drops.length).toBe(3);
    for (const idx of EXPECTED_INDEX_NAMES) {
      expect(sql).toContain(idx);
    }
    for (const idx of D2A_INDEX_NAMES) {
      expect(sql).not.toContain(idx);
    }
    expect(/CREATE\s+INDEX/i.test(sql)).toBe(false);
    expect(/^\s*BEGIN\s*;/m.test(sql)).toBe(false);
  });
});

describe("R1I-d.2B — README pending-migrations inventory", () => {
  const readme = read(README);

  it("lists the canonical d.2B migration file with a description", () => {
    expect(readme).toContain("20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.sql");
    expect(readme).toMatch(/d\.2B/);
  });
  it("lists the canonical d.2B rollback file", () => {
    expect(readme).toContain("20260402000000_phase-1b-r1i-d2b-gateway-pagination-indexes.rollback.sql");
  });
  it("documents that pending-migration files are inert and not authorised for production", () => {
    expect(readme).toMatch(/inert pending migrations/i);
    expect(readme).toMatch(/not auto-applied/i);
  });
  it("references the online concurrent operation and canonical no-op", () => {
    expect(readme).toMatch(/concurrent operation/i);
    expect(readme).toMatch(/verifies and no-ops/i);
  });
  it("preserves prior d.2A migration checksum records", () => {
    expect(readme).toContain("c12e370aba360e45531f4332bc1cf4575ea00025665122c97a671527569cae87");
    expect(readme).toContain("1fb06d0bc65e573f5a34971df0d94714198c6029dfdecbf1224dd61a1e79446d");
  });
  it("preserves prior c.1E / c.3D / c.3H checksum records", () => {
    expect(readme).toContain("53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf");
    expect(readme).toContain("64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e");
    expect(readme).toContain("cb383f407a42161cdc9fe34f2e2235c9079e51534ba78aa84ea8f0473fde3a96");
  });
});
