# Phase 1B-R1I-c.3R-F — Goal Lifecycle Matrix (RATIFIED)

## `savings_goals.status` transitions permitted by `budgetingDeleteGoal`

| Current state | DELETE result | Response | Side effect |
|---|---|---|---|
| `active` | archive | `204` | `status='archived'`, `archived_at`, `archived_by` set |
| `paused` | archive | `204` | archive fields set |
| `completed` | archive | `204` | archive fields set (history preserved) |
| `cancelled` | archive | `204` | archive fields set (history preserved) |
| `archived` | replay | `204` | none (terminal-state idempotent, no reservation) |

## Guards

- Cross-owner or unknown `goalId` → masked `404` with no side effect.
- Pending / retrying round-up instruction linked to this goal → `409 GOAL_HAS_PENDING_FINANCIAL_OPERATIONS`.
- Handler predicate: `.eq("consumer_id", user.id).neq("status", "archived")` — atomic single-statement transition, at most one logical archive per race.

## NEVER_DELETE preservation

- `savings_goals` row is never deleted or truncated.
- `roundup_transactions`, `credit_events`, ledger and payment rows referencing
  the archived goal are preserved verbatim.
