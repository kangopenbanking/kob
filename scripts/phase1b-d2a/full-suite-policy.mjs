#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3A §CI3A-6 — Full-suite policy evaluator.
//
// Reads the three vitest JSON reports (full-suite-run-1..3.json) written by
// the CI workflow and emits a machine-readable verdict to
// full-suite-policy-results.json.
//
// Policy (extended from R1I-d.1V3 and CI3):
//   Per run:
//     * raw failures     ≤ 93
//     * stable failures  ≤ 89 (median across the 3 runs)
//     * skipped          ≤ 7
//     * unhandled errors = 0
//   Cross-run rotation:
//     * Only the four ratified UI-flake tests from
//       docs/audits/phase-1/phase-1b-r1i-b3v-ui-flake-report.md are permitted
//       to rotate between pass and fail.
//     * Any other test rotating between pass and fail across the three runs
//       is an unauthorised rotation → FAIL.
//   Missing report is a hard failure (never silently pass).
//
// Exits non-zero on any policy violation so the workflow fails loud.

import { readFileSync, existsSync, writeFileSync } from "node:fs";

export const RAW_CEILING = 93;
export const STABLE_CEILING = 89;
export const SKIPPED_CEILING = 7;
export const UNHANDLED_CEILING = 0;
export const RUNS = ["full-suite-run-1.json", "full-suite-run-2.json", "full-suite-run-3.json"];

// Ratified UI flake allow-list — see docs/audits/phase-1/phase-1b-r1i-b3v-ui-flake-report.md §2
export const RATIFIED_ROTATION_ALLOWLIST = [
  { file: "src/test/phase6-dashboard-routes.test.tsx", name: "Phase 6 · Merchant dashboard pages render → MerchantApiKeys module loads" },
  { file: "src/pages/__tests__/IdentityGuide.test.tsx", name: "IdentityGuide renders all 4 tabs" },
  { file: "src/pages/__tests__/IdentityGuide.test.tsx", name: "IdentityGuide renders page title" },
  { file: "src/pages/__tests__/SecuritySettings.test.tsx", name: "SecuritySettings renders security settings page for authenticated user" },
];

export function allowed(file, name) {
  return RATIFIED_ROTATION_ALLOWLIST.some((e) => file.endsWith(e.file) && name.includes(e.name));
}

export function extract(reportPath) {
  if (!existsSync(reportPath)) return { path: reportPath, present: false };
  let data;
  try { data = JSON.parse(readFileSync(reportPath, "utf8")); }
  catch (err) { return { path: reportPath, present: true, parseError: String(err.message || err) }; }

  const suites = Array.isArray(data?.testResults) ? data.testResults : [];
  const failing = [];
  const passing = [];
  let skipped = 0;
  let unhandled = 0;
  for (const s of suites) {
    const file = s.name || s.testFilePath || "";
    for (const a of s.assertionResults || []) {
      const identity = `${file}::${a.fullName || a.title || ""}`;
      if (a.status === "passed") passing.push(identity);
      else if (a.status === "failed") failing.push({ identity, file, name: a.fullName || a.title || "" });
      else if (a.status === "skipped" || a.status === "pending" || a.status === "todo") skipped += 1;
    }
    if (s.status === "failed" && (!s.assertionResults || s.assertionResults.length === 0)) unhandled += 1;
  }
  const numFailed = typeof data?.numFailedTests === "number" ? data.numFailedTests : failing.length;
  const numSkipped = typeof data?.numPendingTests === "number" ? data.numPendingTests : skipped;
  return { path: reportPath, present: true, numFailed, numSkipped, unhandled, failing, passing };
}

export function evaluate(observations) {
  const missing = observations.filter((o) => !o.present || typeof o.numFailed !== "number");
  const rawFailures = observations.map((o) => o.numFailed).filter((n) => typeof n === "number");
  const skippedCounts = observations.map((o) => o.numSkipped).filter((n) => typeof n === "number");
  const unhandledCounts = observations.map((o) => o.unhandled).filter((n) => typeof n === "number");

  const sorted = [...rawFailures].sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : null;
  const maxRaw = rawFailures.length ? Math.max(...rawFailures) : null;
  const maxSkipped = skippedCounts.length ? Math.max(...skippedCounts) : null;
  const maxUnhandled = unhandledCounts.length ? Math.max(...unhandledCounts) : null;

  const seen = new Map();
  for (const obs of observations) {
    if (!obs.present) continue;
    for (const p of obs.passing || []) {
      const rec = seen.get(p) || { file: p.split("::")[0], name: p.split("::")[1] || "", states: new Set() };
      rec.states.add("pass");
      seen.set(p, rec);
    }
    for (const f of obs.failing || []) {
      const rec = seen.get(f.identity) || { file: f.file, name: f.name, states: new Set() };
      rec.states.add("fail");
      seen.set(f.identity, rec);
    }
  }
  const rotatingTests = [];
  for (const [identity, rec] of seen) {
    if (rec.states.has("pass") && rec.states.has("fail")) {
      rotatingTests.push({ identity, file: rec.file, name: rec.name, allowed: allowed(rec.file, rec.name) });
    }
  }
  const unauthorisedRotatingTests = rotatingTests.filter((r) => !r.allowed);

  const rawViolation = maxRaw !== null && maxRaw > RAW_CEILING;
  const stableViolation = median !== null && median > STABLE_CEILING;
  const skippedViolation = maxSkipped !== null && maxSkipped > SKIPPED_CEILING;
  const unhandledViolation = maxUnhandled !== null && maxUnhandled > UNHANDLED_CEILING;
  const rotationViolation = unauthorisedRotatingTests.length > 0;

  const verdict = missing.length === 0
    && !rawViolation && !stableViolation
    && !skippedViolation && !unhandledViolation
    && !rotationViolation
    ? "PASS" : "FAIL";

  return {
    policy: {
      raw: `≤ ${RAW_CEILING}`,
      stable: `≤ ${STABLE_CEILING}`,
      skipped: `≤ ${SKIPPED_CEILING}`,
      unhandled: `= ${UNHANDLED_CEILING}`,
    },
    runs: observations.map((o) => ({
      path: o.path, present: o.present,
      numFailed: o.numFailed ?? null,
      numSkipped: o.numSkipped ?? null,
      unhandled: o.unhandled ?? null,
    })),
    rawFailures,
    stableFailures: median,
    skipped: maxSkipped,
    unhandled: maxUnhandled,
    maxRaw,
    median,
    missingReports: missing.map((m) => m.path),
    rotatingTests,
    unauthorisedRotatingTests,
    ratifiedRotationAllowlist: RATIFIED_ROTATION_ALLOWLIST,
    unevaluatedFullSuiteRuns: missing.length,
    rawViolation,
    stableViolation,
    skippedViolation,
    unhandledViolation,
    rotationViolation,
    verdict,
  };
}

function main() {
  const summary = evaluate(RUNS.map(extract));
  writeFileSync("full-suite-policy-results.json", JSON.stringify(summary, null, 2));
  process.stdout.write(JSON.stringify({
    step: "full_suite_policy",
    verdict: summary.verdict, maxRaw: summary.maxRaw, median: summary.median,
    skipped: summary.skipped, unhandled: summary.unhandled,
    unauthorisedRotating: summary.unauthorisedRotatingTests.length,
  }) + "\n");
  if (summary.verdict !== "PASS") process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
