# Phase 1B-R1I-c.3D — Security Review

## Function security model

- `public.roundup_instruction_eligibility_trg()` is declared `SECURITY DEFINER` with `SET search_path = public`.
- Rationale: the trigger must read `public.roundup_settings` and `public.savings_goals` for *any* inserting role — including future privileged callers such as scheduled workers — regardless of the invoker's RLS scope. RLS on those tables restricts to the owner (`consumer_id = auth.uid()`); a service-role or another privileged caller inserting on behalf of a user must still be blocked, and only SECURITY DEFINER guarantees the trigger's SELECTs succeed for every insertion path.
- The function contains **no dynamic SQL**, **no `EXECUTE`**, **no caller-controlled object names**, and every reference is schema-qualified.
- `REVOKE ALL ON FUNCTION public.roundup_instruction_eligibility_trg() FROM PUBLIC` is issued. The function is only ever called by the trigger executor, so no additional `GRANT` is required.
- Ownership: created by the migration executor (database owner). Not delegated.

## Search-path hijack surface

Pinned at function-definition time to `public`. Not derived from `current_setting`, not read from `search_path` at runtime, not modified inside the body.

## Bypass analysis

| Attack path | Result |
|---|---|
| Ordinary authenticated user attempts direct INSERT | RLS blocks first; trigger would additionally reject |
| Service-role INSERT with `enabled=false` in settings | Trigger raises `ROUNDUP_DISABLED` (23514) |
| Service-role INSERT with archived goal | Trigger raises `GOAL_ARCHIVED` (23514) |
| Service-role INSERT with `goal_id` not matching `settings.default_goal_id` | Trigger raises `INVALID_GOAL_SETTINGS_RELATION` |
| Service-role INSERT with no `roundup_settings` row | Trigger raises `MISSING_ELIGIBILITY_RECORD` |
| Worker attempting to bypass via alternate function | The RPC `roundup_insert_if_enabled` itself ultimately performs `INSERT`, which fires the trigger; no bypass exists |
| Attempted `ALTER TRIGGER ... DISABLE` | Requires table-owner privilege — not held by application roles |

## Information-leak review

The exception `MESSAGE` is a fixed literal `ROUNDUP_INSTRUCTION_NOT_ALLOWED`. The `DETAIL` is one of four fixed identifiers. No `NEW.*` value, no consumer id, no tenant id, no financial amount, and no goal id appear in the exception payload. The public API mapping in `budgeting-ops` translates the eligibility rejection into a **no-op** skip (no HTTP response leakage) and, for legacy 409 paths, into the c.3A ratified Problem Details examples that do not include identifiers.

## Standing-order alignment

- **Financial Safety** — Instruction admission is mediated end-to-end by the database invariant; the worker cannot short-circuit it.
- **DB Hardening** — `SECURITY DEFINER` + pinned `search_path` + REVOKE PUBLIC per project standard.
- **Audit Trail** — The trigger identifier `roundup_instruction_eligibility` and stable SQLSTATE make every rejection reproducible in logs.
- **Standing Order 4 (Surgeon)** — Additive only; no existing schema element modified.
