# Phase 1B-R1I-c.3H — Financial Integrity Statement

## Scope of change (financial surface)

The c.3H slice touches exactly one column addition and two check
constraints on `public.savings_goals`, plus two policy re-creations that
extend c.1E denials. No financial table is created, altered, dropped,
truncated, or re-scoped.

## Tables verified untouched by the migration

| Table | Delta | Row-count delta | Hash delta |
|---|---|---|---|
| `savings_goals` | +column, +2 CHECK, ±2 policies | 0 | schema-only |
| `roundup_transactions` | — | 0 | 0 |
| `roundup_events` | — | 0 | 0 |
| `payments` | — | 0 | 0 |
| `bank_transfer_transactions` | — | 0 | 0 |
| `settlement_transactions` | — | 0 | 0 |
| `ledger_accounts` | — | 0 | 0 |
| `ledger_posting_refs` | — | 0 | 0 |
| `journal_entries` | — | 0 | 0 |
| `journal_lines` | — | 0 | 0 |
| `reconciliation_reports` | — | 0 | 0 |
| `reconciliation_mismatches` | — | 0 | 0 |
| `regulatory_reports` | — | 0 | 0 |
| `audit_logs` | — | 0 | 0 |

## Runtime handler (`budgetingDeleteGoal`)

The handler performs a single `UPDATE public.savings_goals SET status,
archived_from_status, archived_at, archived_by WHERE id=? AND
consumer_id=? AND status=?` and reads back only those fields. No debit,
credit, journal entry, ledger update, settlement, reconciliation event
or reversal is emitted. Pending round-up instructions in `pending` or
`retrying` state block archival with `409
GOAL_HAS_PENDING_FINANCIAL_OPERATIONS` and no reservation is stored.

## Required invariants (asserted)

* Physical goal deletes: **0**
* Financial-history deletes: **0**
* Financial-history rewrites: **0**
* Financial postings caused by archival: **0**
* New destructive cascade paths: **0**

Only the target `savings_goals` archival fields change during a
successful archive.
