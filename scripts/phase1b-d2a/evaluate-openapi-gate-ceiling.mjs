#!/usr/bin/env node
/**
 * Phase 1B R1I-d.2A CI14 — OpenAPI Quality-Gate Ceiling Evaluator.
 *
 * Invokes the UNCHANGED global quality-gate script
 * (`scripts/openapi-quality-gates.mjs`) and evaluates its structured summary
 * against the ratified per-gate ceiling for this phase. Applies a strict
 * ratchet: unchanged baseline PASS, reductions PASS, any increase FAIL,
 * malformed / inconsistent evidence FAIL.
 *
 * The global script is a zero-tolerance checker and exits 1 whenever ANY
 * unallowlisted failure exists. The ratified baseline currently carries 176
 * known failures, which is why the phase workflow must ratchet per-gate
 * rather than treat that exit as a regression.
 *
 * NO fallback secrets. NO managed Supabase access. NO changes to the global
 * script or its allowlist. NO changes to the OpenAPI spec.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// ─── Ratified per-gate ceiling (immutable) ─────────────────────────────────
export const EXPECTED_API_VERSION = '4.53.1';
export const EXPECTED_OPERATION_COUNT = 483;
export const GATE_CEILINGS = Object.freeze({
  G1: 0,
  G2: 3,
  G3: 0,
  G4: 0,
  G5: 29,
  G6: 66,
  G7: 0,
  G8: 0,
  G9: 78,
});
export const TOTAL_CEILING = 176;
export const GATE_KEYS = Object.freeze(['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9']);
export const SUMMARY_MARKER = 'OpenAPI quality gates — summary';

// ─── Pure helpers ──────────────────────────────────────────────────────────

/**
 * Extract the JSON object that immediately follows the summary marker in the
 * script stdout. Uses a brace-balancing scanner that respects string and
 * escape state so trailing failure text or additional JSON blocks do not
 * confuse the extractor.
 *
 * @param {string} stdout
 * @returns {{ ok: true, json: string } | { ok: false, reason: string }}
 */
export function extractSummaryJson(stdout) {
  if (typeof stdout !== 'string' || stdout.length === 0) {
    return { ok: false, reason: 'empty-stdout' };
  }
  // Detect duplicate/conflicting summaries first — fail-closed.
  const markerCount = stdout.split(SUMMARY_MARKER).length - 1;
  if (markerCount === 0) return { ok: false, reason: 'missing-marker' };
  if (markerCount > 1) {
    // Only fail on true conflict — extract each block and require they be
    // byte-equivalent. A single script run should emit at most one summary.
    const blocks = [];
    let searchFrom = 0;
    for (;;) {
      const idx = stdout.indexOf(SUMMARY_MARKER, searchFrom);
      if (idx < 0) break;
      const scan = scanBalancedObject(stdout, idx + SUMMARY_MARKER.length);
      if (!scan.ok) return { ok: false, reason: 'malformed-json-after-marker' };
      blocks.push(scan.json);
      searchFrom = scan.end;
    }
    const first = blocks[0];
    if (!blocks.every((b) => b === first)) {
      return { ok: false, reason: 'conflicting-summary-blocks' };
    }
    return { ok: true, json: first };
  }
  const markerIdx = stdout.indexOf(SUMMARY_MARKER);
  const scan = scanBalancedObject(stdout, markerIdx + SUMMARY_MARKER.length);
  if (!scan.ok) return { ok: false, reason: scan.reason };
  return { ok: true, json: scan.json };
}

/**
 * Brace-balancing scanner. Starts at `from`, skips whitespace, then reads
 * the JSON object bounded by matched `{` / `}` while respecting string state.
 *
 * @param {string} src
 * @param {number} from
 */
export function scanBalancedObject(src, from) {
  let i = from;
  while (i < src.length && /\s/.test(src[i])) i += 1;
  if (src[i] !== '{') return { ok: false, reason: 'no-object-after-marker' };
  let depth = 0;
  let inString = false;
  let escape = false;
  const start = i;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { ok: true, json: src.slice(start, i + 1), end: i + 1 };
      }
    }
  }
  return { ok: false, reason: 'unterminated-json-object' };
}

/**
 * Validate the shape of the parsed summary object. Returns a normalised
 * record on success; fails closed on any missing / malformed field.
 *
 * @param {unknown} obj
 */
export function validateSummaryShape(obj) {
  if (!obj || typeof obj !== 'object') {
    return { ok: false, reason: 'summary-not-object' };
  }
  const rec = obj;
  if (typeof rec.apiVersion !== 'string' || rec.apiVersion.length === 0) {
    return { ok: false, reason: 'missing-apiVersion' };
  }
  if (!Number.isInteger(rec.totalOperations) || rec.totalOperations < 0) {
    return { ok: false, reason: 'invalid-totalOperations' };
  }
  if (!Number.isInteger(rec.failures) || rec.failures < 0) {
    return { ok: false, reason: 'invalid-failures' };
  }
  if (!rec.byGate || typeof rec.byGate !== 'object') {
    return { ok: false, reason: 'missing-byGate' };
  }
  const byGate = {};
  for (const key of GATE_KEYS) {
    if (!(key in rec.byGate)) return { ok: false, reason: `missing-gate-${key}` };
    const v = rec.byGate[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      return { ok: false, reason: `invalid-gate-${key}` };
    }
    byGate[key] = v;
  }
  return {
    ok: true,
    summary: {
      apiVersion: rec.apiVersion,
      totalOperations: rec.totalOperations,
      failures: rec.failures,
      byGate,
    },
  };
}

/**
 * Evaluate a validated summary + raw exit status against the ratified
 * ceiling. Pure function — safe to unit-test directly.
 *
 * @param {{
 *   summary: { apiVersion: string, totalOperations: number, failures: number, byGate: Record<string, number> },
 *   rawExitStatus: number | null,
 *   signal?: string | null,
 * }} input
 */
export function evaluateCeiling(input) {
  const { summary, rawExitStatus, signal } = input;
  const reasons = [];
  const regressedGates = [];
  const improvedGates = [];

  if (summary.apiVersion !== EXPECTED_API_VERSION) {
    reasons.push(`apiVersion ${summary.apiVersion} != ${EXPECTED_API_VERSION}`);
  }
  if (summary.totalOperations !== EXPECTED_OPERATION_COUNT) {
    reasons.push(`totalOperations ${summary.totalOperations} != ${EXPECTED_OPERATION_COUNT}`);
  }

  let sumByGate = 0;
  for (const key of GATE_KEYS) {
    const observed = summary.byGate[key];
    const ceiling = GATE_CEILINGS[key];
    sumByGate += observed;
    if (observed > ceiling) {
      reasons.push(`${key} ${observed} > ceiling ${ceiling}`);
      regressedGates.push(key);
    } else if (observed < ceiling) {
      improvedGates.push(key);
    }
  }
  const summaryConsistent = summary.failures === sumByGate;
  if (!summaryConsistent) {
    reasons.push(`failures ${summary.failures} != sumByGate ${sumByGate}`);
  }
  if (summary.failures > TOTAL_CEILING) {
    reasons.push(`failures ${summary.failures} > totalCeiling ${TOTAL_CEILING}`);
  }

  // Raw exit-status consistency with global-script contract.
  if (signal) {
    reasons.push(`signal-terminated:${signal}`);
  } else if (rawExitStatus === null || rawExitStatus === undefined) {
    reasons.push('null-exit-status');
  } else if (summary.failures === 0 && rawExitStatus !== 0) {
    reasons.push(`failures=0 but rawExitStatus=${rawExitStatus}`);
  } else if (summary.failures > 0 && rawExitStatus !== 1) {
    reasons.push(`failures>0 but rawExitStatus=${rawExitStatus}`);
  }

  const exactBaselineMatch =
    summary.failures === TOTAL_CEILING &&
    GATE_KEYS.every((k) => summary.byGate[k] === GATE_CEILINGS[k]);
  const withinRatifiedCeiling = regressedGates.length === 0 && summary.failures <= TOTAL_CEILING;
  const verdict = reasons.length === 0 ? 'PASS' : 'FAIL';

  return {
    verdict,
    reasons,
    regressedGates,
    improvedGates,
    exactBaselineMatch,
    withinRatifiedCeiling,
    summaryConsistent,
    sumByGate,
  };
}

/**
 * Full pipeline against raw command output. Pure — used by tests to feed
 * synthetic stdout / exit codes without spawning the global script.
 *
 * @param {{ stdout: string, stderr: string, status: number | null, signal?: string | null }} cmd
 */
export function evaluateCommandResult(cmd) {
  const extracted = extractSummaryJson(cmd.stdout || '');
  if (!extracted.ok) {
    return {
      verdict: 'FAIL',
      reasons: [`summary-extract:${extracted.reason}`],
      regressedGates: [],
      improvedGates: [],
      exactBaselineMatch: false,
      withinRatifiedCeiling: false,
      summaryConsistent: false,
      sumByGate: 0,
      summary: null,
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(extracted.json);
  } catch (err) {
    return {
      verdict: 'FAIL',
      reasons: [`json-parse:${(err && err.message) || 'error'}`],
      regressedGates: [],
      improvedGates: [],
      exactBaselineMatch: false,
      withinRatifiedCeiling: false,
      summaryConsistent: false,
      sumByGate: 0,
      summary: null,
    };
  }
  const shape = validateSummaryShape(parsed);
  if (!shape.ok) {
    return {
      verdict: 'FAIL',
      reasons: [`summary-shape:${shape.reason}`],
      regressedGates: [],
      improvedGates: [],
      exactBaselineMatch: false,
      withinRatifiedCeiling: false,
      summaryConsistent: false,
      sumByGate: 0,
      summary: null,
    };
  }
  const evalResult = evaluateCeiling({
    summary: shape.summary,
    rawExitStatus: cmd.status,
    signal: cmd.signal || null,
  });
  return { ...evalResult, summary: shape.summary };
}

// ─── Evidence writers ──────────────────────────────────────────────────────

export function buildEvidence({ result, rawExitStatus, signal }) {
  const summary = result.summary || {
    apiVersion: null,
    totalOperations: null,
    failures: null,
    byGate: Object.fromEntries(GATE_KEYS.map((k) => [k, null])),
  };
  return {
    currentRunEvidence: true,
    rawExitStatus: rawExitStatus === undefined ? null : rawExitStatus,
    signal: signal || null,
    apiVersion: summary.apiVersion,
    expectedApiVersion: EXPECTED_API_VERSION,
    totalOperations: summary.totalOperations,
    expectedOperationCount: EXPECTED_OPERATION_COUNT,
    failures: summary.failures,
    totalCeiling: TOTAL_CEILING,
    sumByGate: result.sumByGate,
    byGate: summary.byGate,
    gateCeilings: { ...GATE_CEILINGS },
    regressedGates: result.regressedGates,
    improvedGates: result.improvedGates,
    exactBaselineMatch: result.exactBaselineMatch,
    withinRatifiedCeiling: result.withinRatifiedCeiling,
    summaryConsistent: result.summaryConsistent,
    reasons: result.reasons,
    verdict: result.verdict,
  };
}

// ─── CLI entry point ───────────────────────────────────────────────────────

function isDirectExecution() {
  try {
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
    const self = fileURLToPath(import.meta.url);
    return invoked === self;
  } catch {
    return false;
  }
}

export function runCli({ cwd = process.cwd(), writeFile = fs.writeFileSync, exit = process.exit } = {}) {
  const gateResultsLog = path.join(cwd, 'gate-results.log');
  const evidencePath = path.join(cwd, 'openapi-gate-ceiling-results.json');
  // The global script — intentionally invoked unmodified — is the only
  // source of truth for G1–G9 rule evaluation.
  const spawn = spawnSync(process.execPath, ['scripts/openapi-quality-gates.mjs'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = spawn.stdout || '';
  const stderr = spawn.stderr || '';
  // Persist the complete raw output. Do NOT include environment variables or
  // credentials — only what the child process wrote to its own streams.
  writeFile(gateResultsLog, `${stdout}\n${stderr}\n`, { encoding: 'utf8' });

  const result = evaluateCommandResult({
    stdout,
    stderr,
    status: spawn.status,
    signal: spawn.signal,
  });
  const evidence = buildEvidence({
    result,
    rawExitStatus: spawn.status,
    signal: spawn.signal,
  });
  writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8' });

  if (result.verdict !== 'PASS') {
    console.error(
      '[phase1b-d2a-ci14] OpenAPI gate-ceiling verdict FAIL:',
      JSON.stringify(result.reasons, null, 2),
    );
    exit(1);
    return;
  }
  console.log(
    '[phase1b-d2a-ci14] OpenAPI gate-ceiling verdict PASS — baseline within ratified ceiling.',
  );
  exit(0);
}

if (isDirectExecution()) {
  runCli();
}
