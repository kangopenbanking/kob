# Phase 1B-R1I-c.3D — Database Design

**Slice:** R1I-c.3D — Database-Atomic Round-Up Instruction Eligibility
**Scope:** LOCAL/TEST additive migration. No production deployment.
**API 4.53.1 · 484 operations · Unreleased · Gates 179 · Lint ceiling 5586.**

## Preflight schema confirmation (READ-ONLY against cloud)

| Item | Exact object / column | Evidence |
|---|---|---|
| Instruction table | `public.roundup_transactions` | `information_schema.columns` |
| Primary key | `roundup_transactions.id uuid` | column enum + `gen_random_uuid()` default |
| Goal reference | `roundup_transactions.goal_id uuid` (nullable) | column enum |
| Settings reference | Implicit via `consumer_id` (PK of `public.roundup_settings`) | column enum |
| Enabled state | `public.roundup_settings.enabled boolean NOT NULL DEFAULT false` | column enum |
| Goal archive state | `public.savings_goals.status text NOT NULL DEFAULT 'active'`; `'archived'` permitted by ratified `budgets_status_check`-parallel constraint under c.1E migration | pending migration + schema |
| Owner column (instructions) | `roundup_transactions.consumer_id uuid NOT NULL` | column enum |
| Owner column (settings) | `roundup_settings.consumer_id uuid NOT NULL` (PK) | column enum |
| Owner column (goals) | `savings_goals.consumer_id uuid NOT NULL` | column enum |
| Insertion paths | (a) `public.roundup_insert_if_enabled(...)` SECURITY DEFINER RPC — sole worker path (c.3R-F); (b) any privileged direct INSERT (admin / service-role) | grep of `budgeting-ops/index.ts` |
| Existing triggers on instruction table | None (base table has only the `updated_at` housekeeping trigger from the roundup migration lineage) | schema inspection |

## Chosen invariant model

Single `BEFORE INSERT FOR EACH ROW` trigger `roundup_instruction_eligibility_before_insert` on `public.roundup_transactions`, executing `public.roundup_instruction_eligibility_trg()`. RPC model was **not** chosen because the trigger fires on *every* insertion path — including any privileged bypass — whereas an alternative RPC would leave direct `INSERT` unguarded.

## Deterministic lock order

1. `SELECT ... FROM public.roundup_settings WHERE consumer_id = NEW.consumer_id FOR SHARE`
2. `SELECT ... FROM public.savings_goals   WHERE id = NEW.goal_id           FOR SHARE`

`FOR SHARE` is sufficient because it conflicts with the row-exclusive lock taken by `UPDATE public.roundup_settings SET enabled=false` and by `UPDATE public.savings_goals SET status='archived'`. All related code MUST acquire settings before goal to avoid deadlock.

## Serialisation property (proved by lock semantics)

| First writer | Effect on second |
|---|---|
| INSERT acquires FOR SHARE first | Disable/archive waits until INSERT commits; the row created is legal at its commit time |
| Disable/archive acquires FOR UPDATE first | INSERT's FOR SHARE blocks; upon disable/archive commit, INSERT observes terminal state and RAISEs |

## Rejected internal reasons (stable identifiers)

- `ROUNDUP_DISABLED`
- `GOAL_ARCHIVED`
- `MISSING_ELIGIBILITY_RECORD`
- `INVALID_GOAL_SETTINGS_RELATION`

All raised as `SQLSTATE 23514` with `CONSTRAINT roundup_instruction_eligibility` and a machine-readable message `ROUNDUP_INSTRUCTION_NOT_ALLOWED`. Public API responses continue to use the c.3A ratified Problem Details; database detail is NOT surfaced verbatim.

## Non-scope confirmations

- No new columns, no new tables, no new indexes.
- No CASCADE, no DELETE, no TRUNCATE, no financial-history mutation.
- Trigger fires only on INSERT — Policy A (pending / retrying / completed update paths) untouched.
