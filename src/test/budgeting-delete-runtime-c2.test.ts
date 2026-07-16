// Phase 1B-R1I-c.2 — Budget archive & Category soft-delete runtime source contract.
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

describe('Phase 1B-R1I-c.2 — Budgeting DELETE runtime (source contract)', () => {
  it('imports the shared hardened idempotency helper', () => {
    expect(src).toMatch(/from ["']\.\.\/_shared\/integration-layer\/idempotency\.ts["']/);
    expect(src).toMatch(/isStrictUuidV4/);
    expect(src).toMatch(/reserveIdempotency/);
    expect(src).toMatch(/storeIdempotency/);
    expect(src).toMatch(/idempotencyResponse/);
  });

  it('imports the shared RFC 7807 problem helper', () => {
    expect(src).toMatch(/from ["']\.\.\/_shared\/integration-layer\/problem\.ts["']/);
    expect(src).toMatch(/problemResponse/);
  });

  it('routes both DELETE operations under budgeting-ops', () => {
    expect(src).toMatch(/method === "DELETE" && delBudgetMatch/);
    expect(src).toMatch(/method === "DELETE" && delCatMatch/);
    expect(src).toMatch(/^\s*const delBudgetMatch = path\.match\(\/\^\\\/budgets\\\/\(\[\^\/\]\+\)\$\/\);/m);
    expect(src).toMatch(/^\s*const delCatMatch = path\.match\(\/\^\\\/categories\\\/\(\[\^\/\]\+\)\$\/\);/m);
  });

  it('validates resource identifier as UUID before any DB call (400 INVALID_RESOURCE_ID)', () => {
    expect(src).toMatch(/UUID_ANY_RE\.test\(budgetId\)/);
    expect(src).toMatch(/UUID_ANY_RE\.test\(categoryId\)/);
    expect(src).toContain('INVALID_RESOURCE_ID');
  });

  it('rejects malformed and non-UUIDv4 idempotency keys with 400 (rejects UUIDv5)', () => {
    // Strict UUIDv4 gate is the only accepted format for the header.
    expect(src).toMatch(/isStrictUuidV4\(raw\)/);
    expect(src).toContain('INVALID_IDEMPOTENCY_KEY');
  });

  it('returns masked 404 for absent OR cross-owner resources (no 403)', () => {
    expect(src).toMatch(/existing\.consumer_id !== user\.id[^\n]*notFoundProblem/);
    expect(src).not.toMatch(/status:\s*403/);
  });

  it('archives budgets non-destructively (status=archived + archived_at + archived_by)', () => {
    expect(src).toMatch(/status:\s*"archived",\s*archived_at:\s*nowIso,\s*archived_by:\s*user\.id/);
    // Atomic conditional transition
    expect(src).toMatch(/\.eq\("status",\s*"active"\)[\s\S]{0,120}\.select\("id"\)\s*\.maybeSingle/);
  });

  it('soft-deletes categories non-destructively (status=deleted + deleted_at + deleted_by)', () => {
    expect(src).toMatch(/status:\s*"deleted",\s*deleted_at:\s*nowIso,\s*deleted_by:\s*user\.id/);
  });

  it('protects system categories with 409 SYSTEM_CATEGORY_PROTECTED', () => {
    expect(src).toContain('SYSTEM_CATEGORY_PROTECTED');
    expect(src).toMatch(/existing\.is_system[\s\S]{0,120}SYSTEM_CATEGORY_PROTECTED/);
  });

  it('rejects active dependencies with 409 CATEGORY_HAS_ACTIVE_DEPENDENCIES', () => {
    expect(src).toContain('CATEGORY_HAS_ACTIVE_DEPENDENCIES');
    // Atomicity: dependency guard is part of the UPDATE WHERE clause, not a
    // non-transactional select-then-update.
    expect(src).toMatch(/\.or\("spent\.is\.null,spent\.eq\.0"\)/);
  });

  it('terminal-state repeats return 204 and create no reservation', () => {
    // Pre-check on archived/deleted returns 204 BEFORE reserveIdempotency runs.
    const budgetBlock = src.slice(src.indexOf('delBudgetMatch'), src.indexOf('delCatMatch'));
    expect(budgetBlock).toMatch(/existing\.status === "archived"[\s\S]{0,80}no204\(\)/);
    expect(budgetBlock.indexOf('no204()')).toBeLessThan(budgetBlock.indexOf('reserveIdempotency'));
    const catBlock = src.slice(src.indexOf('delCatMatch'));
    expect(catBlock).toMatch(/existing\.status === "deleted"[\s\S]{0,40}no204\(\)/);
  });

  it('idempotency conflicts surface IDEMPOTENCY_KEY_REUSED / IDEMPOTENCY_REQUEST_IN_PROGRESS', () => {
    expect(src).toContain('IDEMPOTENCY_KEY_REUSED');
    expect(src).toContain('IDEMPOTENCY_REQUEST_IN_PROGRESS');
  });

  it('emits bodyless 204 without Content-Type (shared c.2B contract)', () => {
    expect(src).toMatch(/new Response\(null,\s*\{\s*status:\s*204/);
    expect(src).toMatch(/"X-Idempotent-Replay":\s*"false"/);
    // no Content-Type in the 204 branch
    const no204Block = src.slice(src.indexOf('function no204'), src.indexOf('function no204') + 300);
    expect(no204Block).not.toMatch(/Content-Type/);
  });

  it('write guard: PATCH /budgets/:id/categories/:catKey blocks deleted / system categories', () => {
    expect(src).toMatch(/\.eq\("status",\s*"active"\)\s*\/\/\s*c\.2R guard/);
    expect(src).toMatch(/\.eq\("is_system",\s*false\)\s*\/\/\s*c\.2R guard/);
  });

  it('does not touch ledger, transactions, or roundup_transactions', () => {
    // Zero financial-history mutation from these branches.
    const delRegion = src.slice(src.indexOf('Phase 1B-R1I-c.2R'));
    expect(delRegion).not.toMatch(/from\("transactions"\)[\s\S]{0,120}\.(update|delete|insert)/);
    expect(delRegion).not.toMatch(/from\("roundup_transactions"\)[\s\S]{0,120}\.(update|delete|insert)/);
    expect(delRegion).not.toMatch(/from\("ledger_/);
    expect(delRegion).not.toMatch(/from\("payments"\)/);
  });
});
