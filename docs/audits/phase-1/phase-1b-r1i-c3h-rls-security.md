# Phase 1B-R1I-c.3H — RLS & Security Review

**Table:** `public.savings_goals`
**Prior baseline:** c.1E policies (owner SELECT/INSERT/UPDATE, no archived
writes by clients).

## Threats addressed

| Threat | Mitigation |
|---|---|
| Client forges `archived_from_status` | INSERT and UPDATE WITH CHECK forbid non-NULL `archived_from_status` |
| Client forges `archived_at` or `archived_by` | Retained from c.1E — WITH CHECK forbids non-NULL values |
| Client sets `status='archived'` directly | Retained from c.1E — INSERT restricted to `active/paused`; UPDATE USING forbids acting on already-archived rows and WITH CHECK forbids transitioning into `archived` |
| Client reactivates an archived goal | UPDATE USING clause requires `status <> 'archived'` — cannot target archived rows |
| Cross-owner or cross-tenant read | Retained from c.1E — SELECT policy scopes to `consumer_id = auth.uid()` |
| Anonymous access | RLS enabled and all policies are `TO authenticated`; no `TO anon` grant |

## Backend-only archival transition

The atomic transition (`active|paused|completed|cancelled → archived`) is
performed by the `budgeting-ops` edge function using the service_role key
returned by `requireUser()`. Service role bypasses RLS, so the c.3H
policies remain safe to leave in their locked-down form for every
ordinary caller. Ownership is still enforced explicitly by the handler
predicate (`.eq('consumer_id', user.id)`) so the service_role write is
scoped to the authenticated caller.

## Policy diff vs c.1E

`savings_goals_owner_insert.WITH CHECK`:
```
+ AND archived_from_status IS NULL
```

`savings_goals_owner_update.WITH CHECK`:
```
+ AND archived_from_status IS NULL
```

No new SELECT surface. No policy widened. Anonymous access remains
denied.

## Function-safety

No new `SECURITY DEFINER` functions are added in this slice. The two
`DO $$ ... $$` blocks execute at migration time only and do not persist.
The c.3D `SECURITY DEFINER` trigger function `roundup_check_eligibility`
is untouched and continues to hold its fixed `search_path=public` and
`REVOKE EXECUTE FROM PUBLIC` posture.
