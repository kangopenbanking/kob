#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI9 — pg_cron and pg_net extension reproducibility audit.
// Scans supabase/migrations in timestamp order and reports every CREATE
// EXTENSION statement touching pg_cron or pg_net. Fails closed on:
//   - later unguarded pg_cron / pg_net creations
//   - executable creation branches not targeting the extensions schema
//   - pg_catalog schema targets
//   - ALTER EXTENSION ... SET SCHEMA on either extension
//   - DROP EXTENSION on either extension
//   - exception swallowing around extension creation
// Does not connect to any database and does not read any secrets.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const DIR = resolve(ROOT, "supabase/migrations");
const OUT_JSON = resolve(ROOT, "extension-reproducibility-audit.json");

const EXTS = ["pg_cron", "pg_net"];

function lineNumberOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function statementSurrounding(text, index, span = 400) {
  const start = Math.max(0, index - span);
  const end = Math.min(text.length, index + span);
  return text.slice(start, end);
}

function isGuarded(surrounding, ext, statementText) {
  // Accept either: DO block with pg_catalog.pg_extension existence check for
  // this extname, OR an inline `IF NOT EXISTS` clause on the CREATE EXTENSION.
  const doGuard = new RegExp(
    `IF\\s+NOT\\s+EXISTS\\s*\\([^)]*pg_catalog\\.pg_extension[^)]*extname\\s*=\\s*'${ext}'`,
    "is",
  ).test(surrounding);
  const inlineGuard = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS/i.test(statementText);
  return doGuard || inlineGuard;
}

function targetsExtensions(statementText) {
  // Executable CREATE clause must target extensions schema (WITH SCHEMA
  // extensions or SCHEMA extensions). Missing schema clause is treated as
  // non-compliant for the fallback branch.
  return /WITH\s+SCHEMA\s+extensions|(^|\s)SCHEMA\s+extensions/i.test(statementText);
}

function requestsPgCatalog(statementText) {
  return /SCHEMA\s+pg_catalog/i.test(statementText);
}

function hasExceptionSwallow(text, index) {
  // Only flag exception swallowing that appears INSIDE the same DO $$ ... END
  // block that contains this CREATE EXTENSION statement. Adjacent unrelated
  // DO blocks (e.g. pgmq.create wrappers) must not trigger a false positive.
  const before = text.slice(0, index);
  const doStart = before.lastIndexOf("DO $$");
  const priorEnd = before.lastIndexOf("END $$");
  if (doStart === -1 || priorEnd > doStart) return false;
  const after = text.slice(index);
  const endRel = after.indexOf("END");
  if (endRel === -1) return false;
  const block = text.slice(doStart, index + endRel);
  return /EXCEPTION\s+WHEN\s+(OTHERS|duplicate_object)/i.test(block);
}


const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const occurrences = [];
const errors = [];
let alterSetSchema = 0;
let dropExtension = 0;

for (const file of files) {
  const path = resolve(DIR, file);
  const text = readFileSync(path, "utf8");

  for (const ext of EXTS) {
    // Match CREATE EXTENSION [IF NOT EXISTS] <ext> [WITH] [SCHEMA <s>];
    const re = new RegExp(
      `CREATE\\s+EXTENSION(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${ext}\\b[^;]*;`,
      "gi",
    );
    let m;
    while ((m = re.exec(text)) !== null) {
      const line = lineNumberOf(text, m.index);
      const stmt = m[0];
      const surrounding = statementSurrounding(text, m.index);
      const guarded = isGuarded(surrounding, ext, stmt);
      const schemaExtensions = targetsExtensions(stmt);
      const pgCatalog = requestsPgCatalog(stmt);
      const exceptionSwallowed = hasExceptionSwallow(surrounding);
      occurrences.push({
        extension: ext,
        file,
        line,
        statement: stmt.replace(/\s+/g, " ").trim(),
        earliestAuthoritative: false,
        guarded,
        schemaExtensions,
        pgCatalog,
        exceptionSwallowed,
      });
    }

    // ALTER EXTENSION ... SET SCHEMA
    const alterRe = new RegExp(
      `ALTER\\s+EXTENSION\\s+${ext}\\b[^;]*SET\\s+SCHEMA[^;]*;`,
      "gi",
    );
    if (alterRe.test(text)) {
      alterSetSchema++;
      errors.push({ file, extension: ext, kind: "ALTER_SET_SCHEMA" });
    }

    // DROP EXTENSION
    const dropRe = new RegExp(`DROP\\s+EXTENSION[^;]*\\b${ext}\\b[^;]*;`, "gi");
    if (dropRe.test(text)) {
      dropExtension++;
      errors.push({ file, extension: ext, kind: "DROP_EXTENSION" });
    }
  }
}

// Mark earliest authoritative per extension.
for (const ext of EXTS) {
  const first = occurrences.find((o) => o.extension === ext);
  if (first) first.earliestAuthoritative = true;
}

let laterUnguarded = 0;
let invalidSchema = 0;
let pgCatalogRequests = 0;
let exceptionSwallowed = 0;

for (const o of occurrences) {
  if (o.pgCatalog) {
    pgCatalogRequests++;
    errors.push({ ...o, kind: "PG_CATALOG_SCHEMA_REQUESTED" });
  }
  if (o.earliestAuthoritative) continue;
  if (!o.guarded) {
    laterUnguarded++;
    errors.push({ ...o, kind: "LATER_UNGUARDED" });
  }
  if (!o.schemaExtensions) {
    invalidSchema++;
    errors.push({ ...o, kind: "SCHEMA_NOT_EXTENSIONS" });
  }
  if (o.exceptionSwallowed) {
    exceptionSwallowed++;
    errors.push({ ...o, kind: "EXCEPTION_SWALLOWED" });
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  migrationsScanned: files.length,
  pgCronOccurrences: occurrences.filter((o) => o.extension === "pg_cron").length,
  pgNetOccurrences: occurrences.filter((o) => o.extension === "pg_net").length,
  laterUnguarded,
  invalidSchemaTargets: invalidSchema,
  pgCatalogRequests,
  alterSetSchema,
  dropExtension,
  exceptionSwallowed,
  occurrences,
  errors,
};

writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(
  {
    migrationsScanned: summary.migrationsScanned,
    pgCronOccurrences: summary.pgCronOccurrences,
    pgNetOccurrences: summary.pgNetOccurrences,
    laterUnguarded,
    invalidSchemaTargets: invalidSchema,
    pgCatalogRequests,
    alterSetSchema,
    dropExtension,
    exceptionSwallowed,
  },
  null,
  2,
));

if (errors.length > 0) {
  console.error(`Extension audit failures: ${errors.length}`);
  for (const e of errors) console.error(JSON.stringify(e));
  process.exit(1);
}
console.log("Extension reproducibility audit: OK");
