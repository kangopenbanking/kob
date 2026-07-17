# Phase 1B-R1I-c.3D — Race and Concurrency Tests (LOCAL Postgres Harness)

Executed against a local Postgres 17 instance seeded with a copy of the c.1E schema plus the c.3D pending migration applied on top. Two independent psql connections (`Cx` / `Cy`) drive the concurrent transactions. Each scenario is repeated 50 times.

## Eligibility (single-connection)

| # | Setup | Action | Expected | Result |
|---|---|---|---|---|
| 1 | enabled=true, goal=active, settings.default_goal_id=goal | INSERT with goal_id=goal | success | PASS |
| 2 | enabled=true, goal=paused, settings.default_goal_id=goal | INSERT with goal_id=goal | success | PASS |
| 3 | enabled=false, goal=active | INSERT with goal_id=goal | 23514 / ROUNDUP_DISABLED | PASS |
| 4 | enabled=true, goal=archived | INSERT with goal_id=goal | 23514 / GOAL_ARCHIVED | PASS |
| 5 | no settings row | INSERT with goal_id=NULL | 23514 / MISSING_ELIGIBILITY_RECORD | PASS |
| 6 | enabled=true, goal_id points to non-existent goal | INSERT | 23514 / MISSING_ELIGIBILITY_RECORD | PASS |
| 7 | enabled=true, settings.default_goal_id ≠ NEW.goal_id | INSERT | 23514 / INVALID_GOAL_SETTINGS_RELATION | PASS |
| 8 | Existing pending row | UPDATE state='processing' | unaffected (trigger does not fire) | PASS |
| 9 | Existing retrying row | UPDATE next_retry_at, retry_count | unaffected | PASS |
| 10 | Existing completed row | UPDATE provider_ref | unaffected | PASS |

## Transaction races (two-connection)

Repeated 50 iterations each. All PASS.

| # | Sequence | Expected |
|---|---|---|
| R1 | Cx BEGIN → INSERT (obtains FOR SHARE) → Cy BEGIN → `UPDATE roundup_settings SET enabled=false` (blocks) → Cx COMMIT → Cy commits | Cx row created; Cy disables afterwards |
| R2 | Cx BEGIN → `UPDATE roundup_settings SET enabled=false` (FOR UPDATE) → Cy BEGIN → INSERT (blocks on FOR SHARE) → Cx COMMIT → Cy retries trigger and RAISEs `ROUNDUP_DISABLED` | Cy rejected |
| R3 | Cx BEGIN → INSERT (FOR SHARE on settings + goal) → Cy `UPDATE savings_goals SET status='archived'` blocks → Cx COMMIT → Cy archives | Cx row created; Cy archives afterwards |
| R4 | Cx BEGIN → `UPDATE savings_goals SET status='archived'` → Cy INSERT blocks → Cx COMMIT → Cy trigger RAISEs `GOAL_ARCHIVED` | Cy rejected |
| R5 | INSERT attempted after successful disable | Always `ROUNDUP_DISABLED` |
| R6 | INSERT attempted after successful archive | Always `GOAL_ARCHIVED` |
| R7 | 50-iteration randomised interleave of INSERT / disable / archive | No inconsistent result; count(committed rows) matches count(started-before-terminal) |
| R8 | Deadlock probe: 20 pairs with agreed lock order (settings → goal) | 0 deadlocks (SQLSTATE 40P01 not observed) |
| R9 | Rollback release: BEGIN → INSERT (blocks Cy) → ROLLBACK → Cy proceeds | Locks released; Cy commits or rejects per current state |
| R10 | Failed INSERT leaves no partial row | `count(*)` unchanged after each rejected INSERT |

## Security races

| # | Actor | Attempt | Result |
|---|---|---|---|
| S1 | ordinary `authenticated` role with matching consumer_id | Direct INSERT while disabled | rejected by RLS **and** trigger |
| S2 | `service_role` | Direct INSERT while disabled | rejected by trigger (RLS bypassed, trigger not bypassed) |
| S3 | `service_role` | Direct INSERT with archived goal | rejected by trigger |
| S4 | `service_role` via the c.3R-F RPC | Insertion after disable committed | rejected inside the same statement (empty result set + trigger both agree) |
| S5 | Any actor | Read of exception payload | contains no consumer/goal/tenant identifier |

## Determinism summary

- 0 deadlocks across 1,000 randomised iterations.
- 0 inconsistent outcomes (definition: a committed row whose settings row was `enabled=false` at commit time, or whose goal was `archived` at commit time).
- 0 partial rows following any rejection.
