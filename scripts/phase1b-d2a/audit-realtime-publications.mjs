#!/usr/bin/env node
// CI7 realtime publication idempotency sweep — read-only static audit.
// Never connects to any database. Never reads secrets.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const OUTPUT_PATH = "realtime-publication-audit.json";

const STMT_RE =
  /ALTER\s+PUBLICATION\s+(\w+)\s+ADD\s+TABLE\s+(?:(\w+)\.)?(\w+)\s*;/gi;
const GUARD_RE =
  /pg_publication_tables[\s\S]*?pubname\s*=\s*'([^']+)'[\s\S]*?(?:schemaname\s*=\s*'([^']+)'[\s\S]*?)?tablename\s*=\s*'([^']+)'/gi;
const EXCEPTION_RE = /EXCEPTION\s+WHEN\s+duplicate_object/i;

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const statements = [];

for (const file of files) {
  const full = join(MIGRATIONS_DIR, file);
  const text = readFileSync(full, "utf8");
  const lines = text.split("\n");

  // Collect guard hits: {tablename -> [lineNumbers]}
  const guardsByTable = new Map();
  for (const m of text.matchAll(GUARD_RE)) {
    const tbl = m[3];
    const idx = m.index ?? 0;
    const line = text.slice(0, idx).split("\n").length;
    if (!guardsByTable.has(tbl)) guardsByTable.set(tbl, []);
    guardsByTable.get(tbl).push(line);
  }

  for (const m of text.matchAll(STMT_RE)) {
    const publication = m[1];
    const schema = m[2] ?? "public";
    const table = m[3];
    const idx = m.index ?? 0;
    const stmtLine = text.slice(0, idx).split("\n").length;

    // Guarded if a matching pg_publication_tables check for same table
    // appears within 30 lines above.
    const guardLines = guardsByTable.get(table) ?? [];
    const guarded = guardLines.some(
      (gl) => gl <= stmtLine && stmtLine - gl <= 30,
    );

    // Exception-swallowed if 'EXCEPTION WHEN duplicate_object' appears
    // within 15 lines after.
    const window = lines.slice(stmtLine - 1, stmtLine + 15).join("\n");
    const exceptionSwallowed = EXCEPTION_RE.test(window);

    statements.push({
      file,
      line: stmtLine,
      publication,
      schema,
      table,
      key: `${publication}|${schema}|${table}`,
      guarded,
      exceptionSwallowed,
    });
  }
}

// Group by key
const groups = new Map();
for (const s of statements) {
  if (!groups.has(s.key)) groups.set(s.key, []);
  groups.get(s.key).push(s);
}

const duplicates = [];
const laterUnguarded = [];
for (const [key, occs] of groups) {
  if (occs.length < 2) continue;
  const sorted = [...occs].sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  );
  const [earliest, ...later] = sorted;
  const laterUnguardedForKey = later.filter(
    (o) => !o.guarded && !o.exceptionSwallowed,
  );
  duplicates.push({
    key,
    publication: earliest.publication,
    schema: earliest.schema,
    table: earliest.table,
    earliestFile: earliest.file,
    earliestLine: earliest.line,
    laterOccurrences: later.map((o) => ({
      file: o.file,
      line: o.line,
      guarded: o.guarded,
      exceptionSwallowed: o.exceptionSwallowed,
    })),
    laterUnguardedCount: laterUnguardedForKey.length,
  });
  laterUnguarded.push(...laterUnguardedForKey);
}

const report = {
  totalStatements: statements.length,
  uniqueMemberships: groups.size,
  duplicateMemberships: duplicates.length,
  laterUnguardedRemaining: laterUnguarded.length,
  duplicates,
  laterUnguarded,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
console.log(
  `Publication statements audited: ${report.totalStatements}\n` +
    `Unique memberships: ${report.uniqueMemberships}\n` +
    `Duplicate memberships: ${report.duplicateMemberships}\n` +
    `Later unguarded duplicates remaining: ${report.laterUnguardedRemaining}`,
);

if (report.laterUnguardedRemaining > 0) {
  console.error("\nLater unguarded duplicate occurrences:");
  for (const o of laterUnguarded) {
    console.error(`  ${o.file}:${o.line} → ${o.key}`);
  }
  process.exit(1);
}
