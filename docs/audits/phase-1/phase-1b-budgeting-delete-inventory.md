# Phase 1B-R1I-c.0 — Budgeting Deletion: Forensic Handler Inventory

**Status:** READ-ONLY AUDIT CORRECTION
**API version:** 4.53.1 (Unreleased) — unchanged
**Operation count:** 484 — unchanged
**Production gate total:** 187 — unchanged

## 1. Accepted blocker (confirmed from source)

The five OpenAPI operations below are documented in `public/openapi.json` but have **no runtime handler**. Every request currently reaches the router's terminal 404 branch in `supabase/functions/budgeting-ops/index.ts`.

| Operation ID | Method | Path | Actual runtime |
|---|---|---|---|
| `budgetingDeleteBudget` | DELETE | `/v1/budgeting/budgets/{budgetId}` | No handler; terminal 404 |
| `budgetingDeleteCategory` | DELETE | `/v1/budgeting/categories/{categoryId}` | No handler; terminal 404 |
| `budgetingDeleteRule` | DELETE | `/v1/budgeting/categories/rules/{ruleId}` | No handler; terminal 404 |
| `budgetingDeleteGoal` | DELETE | `/v1/budgeting/goals/{goalId}` | No handler; terminal 404 |
| `budgetingDisableRoundUp` | DELETE | `/v1/budgeting/goals/{goalId}/round-up` | No handler; terminal 404 |

## 2. Forensic verification

Executed source-level checks:

1. **`budgeting-ops/index.ts` method branches (grep on `method === "…"`)**
   Present: `GET`, `POST`, `PATCH` (lines 215, 222, 266, 282, 304, 310, 320, 344, 383, 405, 419, 442, 467, 521, 526, 560, 753, 770, 816, 842, 863).
   **Absent: `DELETE`. Zero DELETE branches in the entire 886-line file.**
2. **Alternate Edge Functions serving `/v1/budgeting/*`**
   `ls supabase/functions | rg -i budget` → **only `budgeting-ops`**. No sibling function.
3. **RPC / middleware interception** — none found; router is a flat if-chain terminating in a 404 response.
4. **Deployed-source alias / worker rewrite** — Cloudflare worker (`infra/cloudflare-worker/src/worker.js`) does path-prefix rewrites only; it does not add handlers.
5. **Backing table for `budgetingDeleteRule`** — `information_schema.tables` in `public` shows no `category_rules` (or equivalent) table. Only: `budgets`, `budget_categories`, `budget_alerts`, `budget_insights`, `savings_goals`, `roundup_settings`, `roundup_transactions`, `roundup_events`, `credit_goals`.

## 3. Required classification (applied in wiring CSV/JSON)

```
Handler symbol:                NONE
Runtime status:                DOCUMENTED_NOT_IMPLEMENTED
Current runtime result:        terminal 404
Idempotency runtime status:    NOT_APPLICABLE_UNTIL_HANDLER_EXISTS
Remediation status:            DOMAIN_AND_DATA_DESIGN_REQUIRED
```

The prior R11 classification (`CORRECTION_REQUIRED — No Idempotency-Key handling`) is **retracted**. It described the operations as handlers that merely ignore `Idempotency-Key`; the actual runtime has no handler at all.

## 4. Files corrected in this slice

- `docs/audits/phase-1/phase-1b-runtime-wiring.csv`
- `docs/audits/phase-1/phase-1b-runtime-wiring.json`

No runtime, test, migration, RLS, OpenAPI, gate script, dependency, lockfile, version, operation-count, SDK/Postman, or deployment change was made.
