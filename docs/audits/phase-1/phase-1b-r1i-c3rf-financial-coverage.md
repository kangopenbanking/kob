# Phase 1B-R1I-c.3R-F — Pending-Financial Coverage

Sources that could create a pending financial obligation against a goal, and
their treatment by the archive gate:

| Source | Table | Blocks archive? | Rationale |
|---|---|---|---|
| Round-up instruction (pending / retrying) | `roundup_transactions` (`state in ('pending','retrying')`) | **YES** — `409 GOAL_HAS_PENDING_FINANCIAL_OPERATIONS` | Uncommitted debit not yet posted |
| Round-up instruction (successful / skipped / failed / reversed) | `roundup_transactions` | NO | Terminal financial history — preserved |
| Manual goal contribution (`budgetingContributeToGoal`) | Written synchronously and settled inline; leaves no pending row | NO | Fully settled at request time |
| Piggybank plan payment | `piggybank_payments` (`status='pending'`) | NO — separate feature (Piggybank ≠ Goal) | Piggybank plans have their own archive path |
| Credit score event | `credit_events` | NO | Ledger-only, no pending obligation |

Round-up is the only source that can hold a pending financial instruction
linked directly to `savings_goals.id` via `roundup_transactions.goal_id`.
The archive handler enforces the block exactly once, before idempotency
reservation, so terminal-state replays never re-run the check.
