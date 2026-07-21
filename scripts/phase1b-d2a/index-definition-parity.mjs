#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3 §CI3-F — Structural index definition parity.
//
// Compares the canonical transactional migration and the online CONCURRENTLY
// operation artefact by parsing each `CREATE INDEX …` statement into a
// structural fingerprint (name, table, columns with order tokens) rather than
// comparing normalised byte lengths. Any structural mismatch (name, table,
// column list, ordering, count of indexes) fails closed.

import { readFileSync, writeFileSync } from "node:fs";

const CANONICAL = "supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql";
const CONCURRENT = "supabase/pending-operations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.concurrent.sql";

const CREATE_INDEX_RX =
  /CREATE\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_.]+)\s*\(([^)]+)\)/gi;

export function extractIndexes(sql) {
  const withoutLineComments = sql.split(/\r?\n/).map((l) => {
    const i = l.indexOf("--");
    return i === -1 ? l : l.slice(0, i);
  }).join("\n");
  const results = [];
  let m;
  CREATE_INDEX_RX.lastIndex = 0;
  while ((m = CREATE_INDEX_RX.exec(withoutLineComments)) !== null) {
    const [, name, table, cols] = m;
    const columns = cols.split(",").map((c) => c.replace(/\s+/g, " ").trim().toUpperCase());
    results.push({ name, table: table.toLowerCase(), columns });
  }
  return results;
}

export function stringify(entry) {
  return `${entry.name}|${entry.table}|${entry.columns.join(",")}`;
}

export function compareParity() {
  const canonical = extractIndexes(readFileSync(CANONICAL, "utf8"));
  const concurrent = extractIndexes(readFileSync(CONCURRENT, "utf8"));
  const canonKeys = canonical.map(stringify).sort();
  const concKeys = concurrent.map(stringify).sort();
  const identical = canonKeys.length === concKeys.length &&
    canonKeys.every((k, i) => k === concKeys[i]);
  return {
    canonicalCount: canonical.length,
    concurrentCount: concurrent.length,
    canonical,
    concurrent,
    structurallyIdentical: identical,
    verdict: identical && canonical.length === 4 ? "PASS" : "FAIL",
  };
}

const isCli = import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1] && process.argv[1].endsWith("index-definition-parity.mjs"));
if (isCli) {
  const summary = compareParity();
  writeFileSync("index-definition-parity.json", JSON.stringify(summary, null, 2));
  process.stdout.write(JSON.stringify({ step: "index_definition_parity", verdict: summary.verdict }) + "\n");
  if (summary.verdict !== "PASS") process.exit(1);
}
