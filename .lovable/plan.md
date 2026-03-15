

# KOB v1: Full Dashboard E2E Audit — Execution Plan

## Scale Assessment

After crawling the router (`App.tsx`), the platform has **~200 authenticated dashboard pages** across 5 portals plus ~80 public/docs pages. This is a massive audit. The plan below is structured in deliverable phases, each producing tangible outputs.

---

## Route Inventory Summary

| Portal | Route Prefix | Page Count |
|--------|-------------|------------|
| Admin | `/admin/*` | 61 pages |
| Institution (FI) | `/fi-portal/*` | 42 pages |
| Merchant | `/merchant/*` | 41 pages |
| Developer (Public Docs) | `/developer/*` (public) | ~65 pages |
| Developer (Protected Tools) | `/developer/*` (auth) | 12 pages |
| Personal | `/credit-score`, `/payments`, etc. | ~20 pages |
| Customer PWA | `/app/*` | separate layout |
| Banking PWA | `/banking/*` | separate layout |
| Business PWA | `/biz/*` | separate layout |
| Public/Marketing | `/`, `/about`, etc. | ~40 pages |

**Total: ~280+ routes**

---

## Phased Execution Plan

### Phase 0 — Page & Feature Inventory Documents

Generate comprehensive markdown inventories per portal to `/mnt/documents/`:

- `admin-routes.md` — all 61 admin routes with component names
- `institution-routes.md` — all 42 FI routes
- `merchant-routes.md` — all 41 merchant routes
- `developer-routes.md` — all 77 developer routes (public + protected)
- `personal-routes.md` — all ~20 personal routes
- `feature-matrix.csv` — master spreadsheet: route × components × API calls × DB tables × status

**Method**: Parse `App.tsx` programmatically to extract every `<Route>` with its path, component, guards, and layout wrapper. Cross-reference with actual page files to identify API calls (`supabase.from()`, `supabase.functions.invoke()`, `supabase.rpc()`) and DB tables touched.

### Phase 1 — Automated Static Analysis (Code-Level Audit)

Rather than browser-based E2E (which would require auth sessions for 5 different roles and 280 page visits), perform a **code-level audit** that catches the most impactful bugs:

1. **Dead Route Detection**: Find routes whose components fail to import or render
2. **API↔UI Mismatch Detection**: For every `supabase.functions.invoke("X")` call, verify the edge function `X` exists in `supabase/functions/`
3. **Body vs Query Param Audit**: Scan all `supabase.functions.invoke()` calls and cross-reference with the corresponding edge function's parameter extraction (body vs searchParams) — the same bug class we just fixed in `gateway-merchant-kyb`
4. **RLS Policy Coverage**: Verify every table referenced by frontend queries has appropriate RLS policies
5. **Empty State & Error Handling**: Check pages for `.error` and empty-data conditional rendering

**Output**: `/mnt/documents/static-analysis-report.md` with categorized findings.

### Phase 2 — Edge Function Contract Audit

For each edge function invoked from the frontend:

1. Extract the function name and the body/params sent
2. Read the edge function's `index.ts` to verify it parses the same fields
3. Flag mismatches (like the KYB bug: body vs query params)
4. Verify CORS headers include all required Supabase headers
5. Check error responses return `error_id` per platform standard

**Output**: `/mnt/documents/edge-function-contract-audit.md`

### Phase 3 — Fix All Critical Findings

Apply fixes for each finding, prioritized:

1. **Critical**: Broken form submissions (body/query param mismatches)
2. **High**: Missing error handling, silent failures
3. **Medium**: UI states not matching DB reality
4. **Low**: Cosmetic issues, status casing inconsistencies

All fixes will be **additive and non-breaking**.

### Phase 4 — Portal-Specific Workflow Verification

For the 5 highest-impact workflows, perform deep code tracing:

1. **Merchant KYB Submit** → admin queue → approval → status update → notification
2. **Institution Registration** → verification → approval → portal access
3. **Payment Charge Create** → webhook → ledger → settlement
4. **Developer App Registration** → sandbox keys → API testing
5. **Personal KYC Submit** → admin review → approval → tier upgrade

Verify each step's code path is complete and connected.

### Phase 5 — Final Report

Generate:
- `/mnt/documents/kob-v1-e2e-audit-report.md` — executive summary
- `/mnt/documents/feature-matrix.csv` — pass/fail per route
- `/mnt/documents/fixes-applied.md` — changelog of all fixes
- `/mnt/documents/known-limitations.md` — remaining gaps with recommendations

---

## What This Plan Does NOT Include (and Why)

- **Playwright test suite**: Building 280+ browser E2E tests requires a dedicated CI pipeline, test user seed scripts, and ~40+ hours of test authoring. This is a project-level initiative, not a single-prompt task. The static analysis approach catches the same bug classes (broken API calls, param mismatches) without the infrastructure overhead.
- **Postman/Newman execution**: The platform has ~190 endpoints. Running them requires sandbox credentials and isolated test data. Instead, the contract audit verifies alignment between frontend calls and edge function implementations.
- **Destructive action testing**: Delete/revoke operations will be verified by code inspection, not execution.

## Estimated Scope

- **Phase 0**: Route inventory generation — ~30 min
- **Phase 1**: Static analysis across 280 routes — ~2-3 hours
- **Phase 2**: Edge function contract audit (~260 functions) — ~2 hours  
- **Phase 3**: Fix critical findings — varies by count
- **Phase 4-5**: Workflow verification + report — ~1-2 hours

This plan delivers maximum coverage with zero risk of breaking production.

