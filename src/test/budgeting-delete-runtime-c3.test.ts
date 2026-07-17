// Phase 1B-R1I-c.3R — Goal archive & Round-up disable runtime source contract.
// Structural, source-inspection assertions. No network / no DB.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const src = fs.readFileSync(
  path.join(root, 'supabase/functions/budgeting-ops/index.ts'),
  'utf-8',
);

// Slice the c.3R region so assertions do not leak into c.2R matches.
const c3Region = (() => {
  const start = src.indexOf('Phase 1B-R1I-c.3R');
  expect(start).toBeGreaterThan(-1);
  return src.slice(start);
})();

describe('Phase 1B-R1I-c.3R — Goal archive & Round-up disable (source contract)', () => {
  it('routes both DELETE operations under budgeting-ops', () => {
    expect(c3Region).toMatch(/const delGoalMatch = path\.match\(\/\^\\\/goals\\\/\(\[\^\/\]\+\)\$\/\)/);
    expect(c3Region).toMatch(/method === "DELETE" && delGoalMatch/);
    expect(c3Region).toMatch(/method === "DELETE" && path === "\/roundup\/settings"/);
  });

  it('validates goal identifier as UUID before any DB call (400 INVALID_RESOURCE_ID)', () => {
    expect(c3Region).toMatch(/UUID_ANY_RE\.test\(goalId\)/);
    expect(c3Region).toContain('INVALID_RESOURCE_ID');
  });

  it('validates Idempotency-Key as strict UUIDv4 for both handlers (400)', () => {
    // Delegates to shared validateIdemHeader which uses isStrictUuidV4.
    const goalBlock = c3Region.slice(
      c3Region.indexOf('delGoalMatch'),
      c3Region.indexOf('/roundup/settings'),
    );
    const roundupBlock = c3Region.slice(c3Region.indexOf('/roundup/settings'));
    expect(goalBlock).toMatch(/validateIdemHeader\(\)/);
    expect(roundupBlock).toMatch(/validateIdemHeader\(\)/);
  });

  it('returns masked 404 for absent OR cross-owner goals (no 403)', () => {
    expect(c3Region).toMatch(/existing\.consumer_id !== user\.id[^\n]*notFoundProblem/);
    expect(c3Region).not.toMatch(/status:\s*403/);
  });

  it('returns masked 404 when roundup settings row is absent', () => {
    const roundupBlock = c3Region.slice(c3Region.indexOf('/roundup/settings'));
    expect(roundupBlock).toMatch(/if \(!existing\) return notFoundProblem\(\)/);
  });

  it('archives goals non-destructively (status=archived + archived_at + archived_by)', () => {
    expect(c3Region).toMatch(
      /status:\s*"archived",\s*archived_at:\s*nowIso,\s*archived_by:\s*user\.id/,
    );
  });

  it('atomic goal archive predicate excludes already-archived rows and scopes to owner', () => {
    const goalBlock = c3Region.slice(
      c3Region.indexOf('delGoalMatch'),
      c3Region.indexOf('/roundup/settings'),
    );
    expect(goalBlock).toMatch(
      /\.from\("savings_goals"\)[\s\S]{0,400}\.eq\("consumer_id",\s*user\.id\)[\s\S]{0,80}\.neq\("status",\s*"archived"\)/,
    );
  });

  it('supports the full ratified goal lifecycle → archived (active/paused/completed/cancelled)', () => {
    // The neq('status','archived') predicate admits every non-terminal
    // ratified state without enumerating them; this is the required shape.
    const goalBlock = c3Region.slice(
      c3Region.indexOf('delGoalMatch'),
      c3Region.indexOf('/roundup/settings'),
    );
    expect(goalBlock).toMatch(/\.neq\("status",\s*"archived"\)/);
    expect(goalBlock).not.toMatch(/\.eq\("status",\s*"active"\)/);
  });

  it('rejects goal archive when pending round-up instructions target the goal (409 GOAL_HAS_PENDING_FINANCIAL_OPERATIONS)', () => {
    expect(c3Region).toContain('GOAL_HAS_PENDING_FINANCIAL_OPERATIONS');
    expect(c3Region).toMatch(
      /\.from\("roundup_transactions"\)[\s\S]{0,300}\.in\("state",\s*\["pending",\s*"retrying"\]\)/,
    );
  });

  it('disables round-up non-destructively (enabled=false + disabled_at + disabled_by)', () => {
    expect(c3Region).toMatch(
      /enabled:\s*false,\s*disabled_at:\s*nowIso,\s*disabled_by:\s*user\.id/,
    );
  });

  it('atomic disable predicate transitions only enabled=true rows for this owner', () => {
    const roundupBlock = c3Region.slice(c3Region.indexOf('/roundup/settings'));
    expect(roundupBlock).toMatch(
      /\.from\("roundup_settings"\)[\s\S]{0,400}\.eq\("consumer_id",\s*user\.id\)[\s\S]{0,80}\.eq\("enabled",\s*true\)/,
    );
  });

  it('terminal-state repeats return 204 and create no reservation', () => {
    const goalBlock = c3Region.slice(
      c3Region.indexOf('delGoalMatch'),
      c3Region.indexOf('/roundup/settings'),
    );
    expect(goalBlock).toMatch(/existing\.status === "archived"[\s\S]{0,80}no204\(\)/);
    expect(goalBlock.indexOf('no204()')).toBeLessThan(goalBlock.indexOf('reserveIdempotency'));

    const roundupBlock = c3Region.slice(c3Region.indexOf('/roundup/settings'));
    expect(roundupBlock).toMatch(/existing\.enabled === false[\s\S]{0,40}no204\(\)/);
    expect(roundupBlock.indexOf('no204()')).toBeLessThan(roundupBlock.indexOf('reserveIdempotency'));
  });

  it('idempotency conflicts surface IDEMPOTENCY_KEY_REUSED / IDEMPOTENCY_REQUEST_IN_PROGRESS for both handlers', () => {
    const goalBlock = c3Region.slice(
      c3Region.indexOf('delGoalMatch'),
      c3Region.indexOf('/roundup/settings'),
    );
    const roundupBlock = c3Region.slice(c3Region.indexOf('/roundup/settings'));
    expect(goalBlock).toContain('IDEMPOTENCY_KEY_REUSED');
    expect(goalBlock).toContain('IDEMPOTENCY_REQUEST_IN_PROGRESS');
    expect(roundupBlock).toContain('IDEMPOTENCY_KEY_REUSED');
    expect(roundupBlock).toContain('IDEMPOTENCY_REQUEST_IN_PROGRESS');
  });

  it('resource key is versioned per operation for idempotency reservations', () => {
    expect(c3Region).toContain('DELETE /v1/budgeting/goals/');
    expect(c3Region).toContain('DELETE /v1/budgeting/roundup/settings');
  });

  it('emits bodyless 204 via the shared c.2B helper for both handlers', () => {
    // Both handlers reuse no204() defined in the c.2 block.
    const goalBlock = c3Region.slice(
      c3Region.indexOf('delGoalMatch'),
      c3Region.indexOf('/roundup/settings'),
    );
    const roundupBlock = c3Region.slice(c3Region.indexOf('/roundup/settings'));
    expect(goalBlock).toMatch(/return no204\(\)/);
    expect(roundupBlock).toMatch(/return no204\(\)/);
  });

  it('financial-history preservation: no update/delete/insert against transactions or ledger tables', () => {
    expect(c3Region).not.toMatch(/from\("transactions"\)[\s\S]{0,120}\.(update|delete|insert)/);
    expect(c3Region).not.toMatch(/from\("ledger_/);
    expect(c3Region).not.toMatch(/from\("payments"\)/);
    // The c.3R region itself must not mutate historical roundup_transactions
    // rows (retry endpoint is outside this region).
    expect(c3Region).not.toMatch(/from\("roundup_transactions"\)[\s\S]{0,120}\.(update|delete|insert)/);
  });

  it('goal archive stores idempotency reservation only after ownership + dependency checks pass', () => {
    const goalBlock = c3Region.slice(
      c3Region.indexOf('delGoalMatch'),
      c3Region.indexOf('/roundup/settings'),
    );
    // reserveIdempotency must come AFTER the pending-financial guard.
    expect(goalBlock.indexOf('GOAL_HAS_PENDING_FINANCIAL_OPERATIONS'))
      .toBeLessThan(goalBlock.indexOf('reserveIdempotency'));
  });

  // ============================================================
  // Instruction-creation atomicity gate (Section 12 write guard).
  // Full-source assertions; not scoped to the c.3R region.
  // ============================================================
  it('processRoundup short-circuits when settings.enabled is false (no roundup_transactions row)', () => {
    expect(src).toMatch(
      /if \(!settings\.enabled\) return \{ skipped: true, reason: "disabled" as const \}/,
    );
  });

  it('processRoundup re-verifies enabled=true against the DB immediately before insert', () => {
    // The re-verify SELECT must appear between getOrCreateSettings and the
    // INSERT into roundup_transactions.
    const proc = src.slice(src.indexOf('async function processRoundup'));
    const gateIdx = proc.indexOf('.eq("enabled", true)');
    const insertIdx = proc.indexOf('.from("roundup_transactions")\n        .insert');
    expect(gateIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeLessThan(insertIdx);
  });

  it('processRoundup refuses to create instructions targeting an archived default goal', () => {
    const proc = src.slice(src.indexOf('async function processRoundup'));
    expect(proc).toMatch(/goalRow\?\.status === "archived"[\s\S]{0,80}reason: "goal_archived"/);
  });

  it('PATCH /roundup/settings rejects attaching an archived goal (409)', () => {
    const patchBlock = src.slice(
      src.indexOf('PATCH" && path === "/roundup/settings"'),
      src.indexOf('POST" && path === "/roundup/preview"'),
    );
    expect(patchBlock).toMatch(
      /goalRow\.status === "archived"[\s\S]{0,80}"goal_archived"[\s\S]{0,20}409/,
    );
  });
});
