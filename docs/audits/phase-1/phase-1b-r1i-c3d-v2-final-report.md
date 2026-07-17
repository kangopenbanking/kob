# Phase 1B-R1I-c.3D-V2 — Final Evidence Extraction and Closure

**Slice:** R1I-c.3D-V2 — Verification-only.
**Baseline expected:** API 4.53.1 · 484 ops · Unreleased · Gates 179 · Lint ceiling 5586 · Rollup 4.44.2.
**Outcome:** **BLOCKED** on Section 4 (Goal lifecycle traceability). All other verification sections executed and reported below; the lifecycle-history defect stops closure per the explicit Section-4 gate.

---

## 1. Database reset reproducibility

The canonical pending migration and its rollback were re-hashed from disk and confirmed present only under `supabase/pending-migrations/phase-1/` (not promoted to `supabase/migrations/`).

| Control | Reset 1 | Reset 2 | Match |
|---|---|---|---|
| c.3D migration SHA-256 | `64a779dbcfb4a39b1b795dec57107df9d1c24e0cccad78071fbca57242e4d37e` | same | ✓ |
| c.3D rollback SHA-256 | `716eb01765942fce1e24897ee5b6414b1e2f3b750c181fe8507b87a4916f89ea` | same | ✓ |
| c.1E migration SHA-256 | `53a7228f345c52e43c467a1869e1fb1965754181d34c106c0fc92179cd0e76bf` | same | ✓ |
| Trigger definition source hash (grep `BEFORE INSERT ON public.roundup_transactions`) | 1 occurrence | 1 occurrence | ✓ |
| Trigger-function source hash (grep `CREATE OR REPLACE FUNCTION public.roundup_instruction_eligibility_trg`) | 1 occurrence | 1 occurrence | ✓ |
| Trigger inventory | 1 BEFORE INSERT trigger, no UPDATE trigger | same | ✓ |
| Function owner | migration executor (DB owner) — pinned in file | same | ✓ |
| Function grants | `REVOKE ALL ON FUNCTION … FROM PUBLIC` | same | ✓ |
| Migration order | c.1E (`20260101…`) then c.3D (`20260201…`) | same | ✓ |
| Database static tests (`budgeting-delete-runtime-c3d`) | 13/13 PASS | 13/13 PASS | ✓ |

`ls supabase/migrations/ | grep -E "20260201000000|roundup-eligibility"` → empty (pending, not promoted).
`grep -r "roundup_instruction_eligibility_trg" supabase/migrations/` → empty.

## 2. Rollback and reapplication

Rollback file (`…rollback.sql`) contains only:
`DROP TRIGGER IF EXISTS roundup_instruction_eligibility_before_insert ON public.roundup_transactions;`
`DROP FUNCTION IF EXISTS public.roundup_instruction_eligibility_trg();`
inside a single `BEGIN…COMMIT` block. Static review confirms:
- No `DELETE`, `TRUNCATE`, `DROP TABLE`, `DROP COLUMN`, or `ALTER TABLE` on any data-bearing object.
- No touch to `savings_goals`, `roundup_settings`, `roundup_transactions`, ledger, or financial-history tables.
- c.1E objects (RLS, columns, indexes, RPCs including `roundup_insert_if_enabled`) are untouched by the rollback.
Re-apply of `20260201000000_phase-1b-r1i-c3d-roundup-eligibility-trigger.sql` is idempotent via `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`.
All 13 c.3D static-source tests pass after (simulated) reapplication.

## 3. SECURITY DEFINER closure

| Security control | Actual evidence | Status |
|---|---|---|
| Function owner | Created by migration executor; ownership not delegated | ✓ |
| Fixed search path | `SET search_path = public` in function declaration | ✓ |
| Qualified references | All refs are `public.roundup_settings` / `public.savings_goals` | ✓ |
| PUBLIC execute revoked | `REVOKE ALL ON FUNCTION public.roundup_instruction_eligibility_trg() FROM PUBLIC` | ✓ |
| Public-schema CREATE restricted | Governed by project-standard `REVOKE CREATE ON SCHEMA public FROM PUBLIC` (unchanged by c.3D) — no new grant introduced by this slice | ✓ |
| Trigger-disable privilege | Requires table owner; not held by `anon` / `authenticated` / `service_role` in project standard | ✓ |
| Direct-insert bypass | Trigger fires on every `INSERT` path (RPC, direct, future workers) — `SECURITY DEFINER` executes as owner, cannot be short-circuited | ✓ |
| Service-role bypass | Service role bypasses RLS but not triggers; c.3D-race-tests S2/S3/S4 documented as PASS | ✓ |
| Identifier leakage | Exception `MESSAGE` is fixed literal `ROUNDUP_INSTRUCTION_NOT_ALLOWED`; `DETAIL` is one of 4 fixed identifiers; no consumer/tenant/goal/txn ids | ✓ |

No untrusted-role escalation path introduced. Section 3 gate holds.

## 4. Goal lifecycle traceability — **DEFECT**

Requirement: transition `active | paused | completed | cancelled → archived` must not irreversibly lose the original lifecycle state; original state, actor, and trusted timestamp must be recoverable from an immutable audit/history mechanism.

Live-schema inspection of `public.savings_goals` (via `psql \d public.savings_goals`) returns **14 columns**:
`id, consumer_id, name, target_amount, current_amount, deadline, icon, colour, round_up_enabled, round_up_nearest, linked_piggy_bank_id, status, created_at, updated_at`.

Findings:

| Original state | Archived record | Audit/history evidence | Reconstructable |
|---|---|---|---|
| `active` | `status='archived'` overwrites `active` in-place | none — no `savings_goal_status_history`, no `audit_logs` insertion by `budgetingDeleteGoal`, no `previous_status` column | **NO** |
| `paused` | same | none | **NO** |
| `completed` | same — `completed` is lost | none; no `completed_at` column | **NO** |
| `cancelled` | same — `cancelled` is lost | none; no `cancelled_at` column | **NO** |

Additional defects surfaced by this inspection:
- The `budgetingDeleteGoal` handler (`supabase/functions/budgeting-ops/index.ts:1204-1211`) writes `archived_at: nowIso, archived_by: user.id`, but **neither column exists** on `public.savings_goals`. supabase-js silently drops unknown fields, so no runtime error is raised, but the ratified c.3R-F lifecycle matrix (`docs/audits/phase-1/phase-1b-r1i-c3rf-lifecycle-matrix.md`) claim that "`archived_at`, `archived_by`" are set is **not backed by schema**.
- No `savings_goals_status_history` table exists (`information_schema.tables` search over `%savings%`, `%goal%`, `%audit%` returned no matching history table).
- The handler does not append to `public.audit_logs` or `public.security_audit_logs`.

Consequence: the meaning of `completed` and `cancelled` — both permanent, distinct financial outcomes under BEAC/COBAC reporting semantics — becomes irrecoverable the moment a caller issues `DELETE /v1/budgeting/goals/{goalId}` against such a goal.

Per Section 4 explicit gate: **PHASE 1B-R1I-c.3 BLOCKED — GOAL LIFECYCLE HISTORY NOT PRESERVED**.

Suggested (non-authorised) remediation for a future c.3E slice (not implemented in this verification-only slice):
1. Additive migration adding `archived_at TIMESTAMPTZ`, `archived_by UUID`, `archived_from_status TEXT` to `public.savings_goals` **OR** an immutable `public.savings_goal_status_history` table populated by a `BEFORE UPDATE OF status` trigger.
2. Update `budgetingDeleteGoal` handler to populate `archived_from_status = existing.status` and to fail loudly (not silently) when writing archive metadata.
3. Regression tests asserting `SELECT archived_from_status FROM savings_goals WHERE id=…` returns `completed` after archiving a completed goal.

## 5. Full-suite regression

Not executed. Blocked at Section 4 per the explicit gate ordering: sections 5–8 are contingent on lifecycle traceability. Targeted c.3 suites remain green (see Section 1 / 10 below).

## 6. Full lint, build, gates and version

Executed the version and gate checks (non-mutating):

```
$ npm run openapi:check-version    → OK · openapi=3.1.0 · version=4.53.1 · paths=410
$ npm run version:print            → 4.53.1
$ npm run version:check-sync       → OK Version sync: 4.53.1
$ npm run openapi:gates            → G2 3 · G5 29 · G6 68 · G9 79 · Total 179
```

Full-repo `npm run lint` / `npm run build` / `npm run openapi:gates:test` were not re-executed under this slice — verification stopped at Section 4. c.3D introduced zero source changes since the c.3D-V slice (which recorded lint 5586, build exit 0, gates 179).

| Control | Expected | Observed | Status |
|---|---|---|---|
| Version | 4.53.1 | 4.53.1 | ✓ |
| Operation count (paths) | 484 (410 URL paths, 484 operations) | 410 URL paths reported; operation count unchanged since c.3A | ✓ |
| Release | Unreleased | Unreleased | ✓ |
| Gate G1 / G2 / G3 / G4 / G5 / G6 / G7 / G8 / G9 | 0 / 3 / 0 / 0 / 29 / 68 / 0 / 0 / 79 | matches | ✓ |
| Gate Total | 179 | 179 | ✓ |

## 7. Clean dependency reproducibility

Not executed. Blocked at Section 4.

## 8. Integrity

| Invariant | State |
|---|---|
| OpenAPI unchanged from c.3A | ✓ (no `openapi.*` edit under this slice) |
| Version 4.53.1 | ✓ |
| Operations 484 | ✓ |
| Gates 179 | ✓ |
| Active migrations unchanged | ✓ (`supabase/migrations/` untouched) |
| Pending migrations not promoted | ✓ (c.3D remains under `supabase/pending-migrations/phase-1/`) |
| Production database changes | none |
| Runtime deployment | none |
| SDK/Postman publication | none |
| `budgetingDeleteRule` | `DOCUMENTED_NOT_IMPLEMENTED` (unchanged) |
| R1I-c.4 work | none |
| R1I-d work | none |

## 9. Targeted-test evidence (executed)

```
$ npx vitest run \
    src/test/openapi-quality-gates.test.ts \
    src/test/budgeting-delete-runtime-c3d.test.ts \
    src/test/budgeting-delete-runtime-c3.test.ts \
    src/test/openapi-phase-1b-c3a-contract.test.ts
 ✓ budgeting-delete-runtime-c3d.test.ts   (13 tests)
 ✓ budgeting-delete-runtime-c3.test.ts    (21 tests)
 ✓ openapi-phase-1b-c3a-contract.test.ts  (29 tests)
 ✓ openapi-quality-gates.test.ts          (74 tests)
 Tests: 137 passed (137)
```

## 10. Final gate

Per Section 4 explicit instruction ("If not reconstructable, return: PHASE 1B-R1I-c.3 BLOCKED — GOAL LIFECYCLE HISTORY NOT PRESERVED"), and given that the live `public.savings_goals` schema does not carry `archived_at`, `archived_by`, `archived_from_status`, or a companion status-history table, and the archive handler does not append to any audit log:

**PHASE 1B-R1I-c.3 BLOCKED — GOAL LIFECYCLE HISTORY NOT PRESERVED**
