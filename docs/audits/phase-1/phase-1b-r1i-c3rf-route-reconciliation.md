# Phase 1B-R1I-c.3R-F — Route Reconciliation

## Canonical vs implemented paths (before this slice)

| Operation | Canonical (OpenAPI) | Implemented router match | Verdict |
|---|---|---|---|
| `budgetingDeleteGoal` | `DELETE /v1/budgeting/goals/{goalId}` | `DELETE /goals/{goalId}` (after prefix strip) | MATCH |
| `budgetingDisableRoundUp` | `DELETE /v1/budgeting/goals/{goalId}/round-up` | `DELETE /roundup/settings` (after prefix strip) | **MISMATCH** |

## Prefix strip

`supabase/functions/budgeting-ops/index.ts:226`
```
const path = url.pathname.replace(/^.*\/budgeting-ops/, "") || "/";
```

Public canonical requests reach the function as
`/functions/v1/budgeting-ops/goals/{goalId}/round-up`. After strip: `/goals/{goalId}/round-up`.
The former `path === "/roundup/settings"` guard never matched a canonical public
request, so the ratified 4.53.1 contract for `budgetingDisableRoundUp` had no
active runtime handler bound to it.

## Correction applied this slice

- Added router branch: `DELETE /goals/{goalId}/round-up` → disable handler.
- Preserved legacy internal alias `DELETE /roundup/settings`; both paths flow
  through the same handler.
- Canonical path adds a goal-scoped ownership check: `roundup_settings.default_goal_id`
  must equal `{goalId}` AND the goal must be owned by the caller, else masked 404.
- Legacy alias keeps prior semantics (no goal scoping) for internal SDK calls.

## Zero-schema-change confirmation

No migration, RLS, table, function or trigger was created, altered or removed
for this reconciliation. All changes are runtime router / handler code.
