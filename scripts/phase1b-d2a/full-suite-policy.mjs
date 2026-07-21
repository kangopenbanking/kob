#!/usr/bin/env node
// Phase 1B — R1I-d.2A-CI3 §CI3-E — Full-suite policy evaluator.
//
// Reads the three vitest JSON reports (full-suite-run-1..3.json) written by
// the CI workflow and emits a machine-readable verdict to
// full-suite-policy-results.json.
//
// Policy (inherited from R1I-d.1V3):
//   * Raw ceiling  — every run's failure count MUST be ≤ 93.
//   * Stable ceiling — median failure count MUST be ≤ 89.
//   * Missing report is a hard failure (never silently pass).
//
// Exits non-zero when the policy is violated so the workflow fails loud.

import { readFileSync, existsSync, writeFileSync } from "node:fs";

const RAW_CEILING = 93;
const STABLE_CEILING = 89;
const RUNS = ["full-suite-run-1.json", "full-suite-run-2.json", "full-suite-run-3.json"];

function failuresIn(reportPath) {
  if (!existsSync(reportPath)) return { path: reportPath, present: false, failed: null };
  let data;
  try {
    data = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (err) {
    return { path: reportPath, present: true, failed: null, parseError: String(err.message || err) };
  }
  const failed =
    (typeof data?.numFailedTests === "number" && data.numFailedTests) ||
    (typeof data?.numFailedTestSuites === "number" && data.numFailedTestSuites) ||
    (Array.isArray(data?.testResults)
      ? data.testResults.reduce((a, r) => a + (r.numFailingTests || 0), 0)
      : null);
  return { path: reportPath, present: true, failed };
}

const observations = RUNS.map(failuresIn);
const missing = observations.filter((o) => !o.present || o.failed === null);
const values = observations.filter((o) => typeof o.failed === "number").map((o) => o.failed);
const sorted = [...values].sort((a, b) => a - b);
const median = sorted.length
  ? sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
  : null;
const maxRaw = values.length ? Math.max(...values) : null;

const rawViolation = maxRaw !== null && maxRaw > RAW_CEILING;
const stableViolation = median !== null && median > STABLE_CEILING;

const verdict = missing.length === 0 && !rawViolation && !stableViolation ? "PASS" : "FAIL";

const summary = {
  policy: { raw: `≤ ${RAW_CEILING}`, stable: `≤ ${STABLE_CEILING}` },
  runs: observations,
  maxRaw,
  median,
  missingReports: missing.map((m) => m.path),
  rawViolation,
  stableViolation,
  unevaluatedFullSuiteRuns: missing.length,
  verdict,
};

writeFileSync("full-suite-policy-results.json", JSON.stringify(summary, null, 2));
process.stdout.write(JSON.stringify({ step: "full_suite_policy", verdict, maxRaw, median }) + "\n");
if (verdict !== "PASS") process.exit(1);
