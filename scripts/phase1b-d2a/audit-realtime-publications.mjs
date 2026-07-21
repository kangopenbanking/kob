#!/usr/bin/env node
// CI7A realtime publication idempotency sweep — read-only static audit.
// Never connects to any database. Never reads secrets.
//
// Policy (CI7A strict):
//   - The earliest occurrence of each (publication, schema, table) is
//     authoritative and always compliant.
//   - Every LATER occurrence must be wrapped in an explicit
//     pg_catalog.pg_publication_tables membership guard (IF NOT EXISTS).
//   - EXCEPTION WHEN duplicate_object (or any exception swallowing) is
//     NEVER accepted as protection; such occurrences are unguarded and
//     the audit exits non-zero.
//
// Optional --self-check flag runs an in-memory synthetic later-duplicate
// that uses exception swallowing only and asserts the audit rejects it.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "supabase/migrations";
const OUTPUT_PATH = "realtime-publication-audit.json";

const STMT_RE =
  /ALTER\s+PUBLICATION\s+(\w+)\s+ADD\s+TABLE\s+(?:(\w+)\.)?(\w+)\s*;/gi;
const GUARD_RE =
  /pg_publication_tables[\s\S]*?pubname\s*=\s*'([^']+)'[\s\S]*?(?:schemaname\s*=\s*'([^']+)'[\s\S]*?)?tablename\s*=\s*'([^']+)'/gi;
const EXCEPTION_RE = /EXCEPTION\s+WHEN\s+(?:duplicate_object|OTHERS)/i;

function guardKey(publication, schema, table) {
  return `${publication}|${schema ?? "public"}|${table}`;
}

function analyze(virtualFiles = null) {
  const files = virtualFiles
    ? Object.keys(virtualFiles).sort()
    : readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

  const statements = [];

  for (const file of files) {
    const text = virtualFiles
      ? virtualFiles[file]
      : readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const lines = text.split("\n");

    const guardsByMembership = new Map();
    for (const m of text.matchAll(GUARD_RE)) {
      const publication = m[1];
      const schema = m[2] ?? "public";
      const table = m[3];
      const idx = m.index ?? 0;
      const line = text.slice(0, idx).split("\n").length;
      const key = guardKey(publication, schema, table);
      if (!guardsByMembership.has(key)) guardsByMembership.set(key, []);
      guardsByMembership.get(key).push(line);
    }

    for (const m of text.matchAll(STMT_RE)) {
      const publication = m[1];
      const schema = m[2] ?? "public";
      const table = m[3];
      const idx = m.index ?? 0;
      const stmtLine = text.slice(0, idx).split("\n").length;

      const key = guardKey(publication, schema, table);
      const guardLines = guardsByMembership.get(key) ?? [];
      const guarded = guardLines.some(
        (gl) => gl <= stmtLine && stmtLine - gl <= 30,
      );

      const window = lines
        .slice(Math.max(0, stmtLine - 15), stmtLine + 15)
        .join("\n");
      const exceptionSwallowed = EXCEPTION_RE.test(window);

      statements.push({
        file,
        line: stmtLine,
        publication,
        schema,
        table,
        key,
        guarded,
        exceptionSwallowed,
      });
    }
  }

  const groups = new Map();
  for (const s of statements) {
    if (!groups.has(s.key)) groups.set(s.key, []);
    groups.get(s.key).push(s);
  }

  const duplicates = [];
  const laterOccurrences = [];
  for (const [key, occs] of groups) {
    if (occs.length < 2) continue;
    const sorted = [...occs].sort((a, b) =>
      a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
    );
    const [earliest, ...later] = sorted;
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
    });
    laterOccurrences.push(...later);
  }

  // STRICT: only guarded===true is compliant. Exception swallowing does
  // NOT protect a later duplicate.
  const laterGuarded = laterOccurrences.filter((o) => o.guarded === true);
  const laterExceptionSwallowed = laterOccurrences.filter(
    (o) => o.exceptionSwallowed === true,
  );
  const laterUnguarded = laterOccurrences.filter((o) => o.guarded !== true);

  return {
    totalStatements: statements.length,
    uniqueMemberships: groups.size,
    duplicateMemberships: duplicates.length,
    laterDuplicateOccurrences: laterOccurrences.length,
    laterGuardedOccurrences: laterGuarded.length,
    laterExceptionSwallowedOccurrences: laterExceptionSwallowed.length,
    laterUnguardedRemaining: laterUnguarded.length,
    duplicates,
    laterUnguarded: laterUnguarded.map((o) => ({
      file: o.file,
      line: o.line,
      key: o.key,
      guarded: o.guarded,
      exceptionSwallowed: o.exceptionSwallowed,
    })),
  };
}

if (process.argv.includes("--self-check")) {
  // Synthetic later duplicate using exception swallowing only must fail.
  const virtual = {
    "0001_earliest.sql":
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.t;\n",
    "0002_later_swallow.sql":
      "DO $$ BEGIN\n" +
      "  BEGIN\n" +
      "    ALTER PUBLICATION supabase_realtime ADD TABLE public.t;\n" +
      "  EXCEPTION WHEN duplicate_object THEN NULL;\n" +
      "  END;\n" +
      "END $$;\n",
  };
  const r = analyze(virtual);
  if (r.laterUnguardedRemaining !== 1 || r.laterExceptionSwallowedOccurrences !== 1) {
    console.error("Self-check FAILED", r);
    process.exit(2);
  }
  console.log("Self-check OK: exception swallowing rejected as unguarded.");
  process.exit(0);
}

if (process.argv.includes("--self-check-exception-only-failure")) {
  // This mode is intentionally expected to exit non-zero. It proves the
  // production failure path rejects exception swallowing instead of treating
  // it as an acceptable guard.
  const virtual = {
    "0001_earliest.sql":
      "ALTER PUBLICATION supabase_realtime ADD TABLE public.t;\n",
    "0002_later_swallow.sql":
      "DO $$ BEGIN\n" +
      "  BEGIN\n" +
      "    ALTER PUBLICATION supabase_realtime ADD TABLE public.t;\n" +
      "  EXCEPTION WHEN duplicate_object THEN NULL;\n" +
      "  END;\n" +
      "END $$;\n",
  };
  const r = analyze(virtual);
  if (r.laterUnguardedRemaining > 0 || r.laterExceptionSwallowedOccurrences > 0) {
    console.error("Synthetic exception-swallowing later duplicate rejected.");
    process.exit(1);
  }
  console.error("Synthetic exception-swallowing later duplicate was not rejected.");
  process.exit(2);
}

const report = analyze();
writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2));
console.log(
  `Publication statements audited: ${report.totalStatements}\n` +
    `Unique memberships: ${report.uniqueMemberships}\n` +
    `Duplicate memberships: ${report.duplicateMemberships}\n` +
    `Later duplicate occurrences: ${report.laterDuplicateOccurrences}\n` +
    `Later membership-guarded occurrences: ${report.laterGuardedOccurrences}\n` +
    `Later exception-swallowed occurrences: ${report.laterExceptionSwallowedOccurrences}\n` +
    `Later unguarded occurrences: ${report.laterUnguardedRemaining}`,
);

let failed = false;
if (report.laterUnguardedRemaining > 0) {
  console.error("\nLater unguarded duplicate occurrences:");
  for (const o of report.laterUnguarded) {
    console.error(
      `  ${o.file}:${o.line} → ${o.key} (guarded=${o.guarded}, exceptionSwallowed=${o.exceptionSwallowed})`,
    );
  }
  failed = true;
}
if (report.laterExceptionSwallowedOccurrences > 0) {
  console.error(
    "\nException swallowing is not accepted as protection; use pg_publication_tables guards.",
  );
  failed = true;
}
if (failed) process.exit(1);
