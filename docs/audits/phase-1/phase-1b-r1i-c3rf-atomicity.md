# Phase 1B-R1I-c.3R-F — Round-Up Instruction Atomicity (RESOLVED)

## Requirement

After `budgetingDisableRoundUp` returns `204`, zero new instructions may be
inserted into `roundup_transactions` for that consumer.

## Resolution

Database Owner authorization was granted. A `SECURITY DEFINER` SQL function,
`public.roundup_insert_if_enabled`, now performs the write as a single
`INSERT ... SELECT` statement:

```sql
INSERT INTO public.roundup_transactions (...)
SELECT ... FROM public.roundup_settings s
WHERE s.consumer_id = p_consumer_id
  AND s.enabled = true
RETURNING *;
```

Guarantees:

- **True single-statement atomicity.** If `roundup_settings.enabled = false`
  at the instant the statement executes, zero rows are inserted; the RPC
  returns an empty set and the handler reports `{ skipped: true, reason: "disabled" }`.
- **Archived-goal gate inside the same statement.** The `goal_id` column is
  set to `NULL` atomically if the referenced `savings_goal.status = 'archived'`
  for the same consumer, closing the goal-archive/instruction race.
- **Search path pinned.** `SET search_path = public` prevents schema hijack.
- **Least privilege.** `REVOKE ... FROM PUBLIC` + `GRANT EXECUTE` limited to
  `authenticated` and `service_role`; the caller is still bound by RLS-scoped
  parameters (`p_consumer_id` is provided by the edge function from the
  JWT-verified `user.id`).

## Runtime wiring

`supabase/functions/budgeting-ops/index.ts` — `processRoundup()` no longer
performs a direct `INSERT` on `roundup_transactions`. All instruction
creation flows through `sb.rpc("roundup_insert_if_enabled", { ... })`. The
in-memory `settings.enabled` short-circuit is retained as a fast path but is
no longer part of the correctness proof.

## Test coverage

`src/test/budgeting-delete-runtime-c3.test.ts`:

- `processRoundup uses the atomic roundup_insert_if_enabled RPC as the sole
  insert path` — asserts the RPC call site and the absence of any direct
  `.from("roundup_transactions").insert(...)` in `processRoundup`.
- `processRoundup treats an empty RPC result as a disabled-race skip (no row
  created)` — asserts the zero-row branch.

## Migration reference

`roundup_insert_if_enabled(uuid, text, text, uuid, uuid, text, uuid, numeric,
numeric, numeric, integer, text, text, text)` — approved and applied via the
Lovable Cloud migration workflow under c.3R-F authorization. No table
structure changed, no data deleted.
