# Phase 1B-R1I-c.3R-F — Round-Up Instruction Atomicity

## Requirement

After `budgetingDisableRoundUp` returns `204`, zero new instructions may be
inserted into `roundup_transactions` for that consumer.

## Current runtime (post c.3R-F router fix)

1. `processRoundup()` early-returns `disabled` if the in-memory `settings.enabled` is false.
2. Immediately before insert, `processRoundup()` re-reads `roundup_settings.enabled=true` via a scoped `.select().eq("enabled", true).maybeSingle()`.
3. Disable handler flips `enabled=true → false` in a single conditional `UPDATE`.

The disable itself IS atomic (single-statement predicate update). The
**instruction-creation gate** is NOT atomic: the re-verify + insert crosses
two PostgREST round-trips, leaving a narrow race window between step 2 and
the subsequent `.insert()` in `processRoundup()`.

## Options considered (no-migration)

| Option | Assessment |
|---|---|
| Reorder to `insert().eq(enabled,true)` in one round-trip | PostgREST does not support conditional `INSERT ... WHERE`. Rejected. |
| Optimistic insert + post-check + delete | Violates NEVER_DELETE on `roundup_transactions`. Rejected. |
| Post-insert set `state='skipped'` on disabled races | Still creates a row, so still fails the "zero new instructions after disable" guarantee. Rejected. |

## Options requiring Database Owner authorization

| Option | Effect |
|---|---|
| SECURITY DEFINER RPC `roundup_insert_if_enabled(consumer_id, ...)` performing `INSERT ... SELECT FROM roundup_settings WHERE enabled=true` in one statement | True single-statement atomicity. |
| Partial CHECK / trigger `BEFORE INSERT ON roundup_transactions` that raises when `roundup_settings.enabled=false` for the same consumer | True DB-side gate; deterministic. |

Both require a migration (RPC or trigger).

## Gate decision

Per the c.3R-F authorization:

> "If atomicity requires an RPC, function, constraint or migration, stop for
> Database Owner authorization"

**STOPPING for Database Owner authorization** for the atomicity RPC / trigger.
Router reconciliation, lifecycle matrix ratification, and financial-coverage
enforcement are complete under this slice; the residual instruction-creation
race remains narrowed (single DB round-trip window) but not proven zero.
