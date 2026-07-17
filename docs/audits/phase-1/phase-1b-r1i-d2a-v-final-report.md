# Phase 1B — R1I-d.2A-V — Final Implementation Verification

**Scope:** Read-only verification of the R1I-d.2A slice. No production action performed. No d.2B–d.2F work performed. Foundation (`supabase/functions/_shared/pagination.ts`) unchanged. Version unchanged (4.53.1, Unreleased). Operation count unchanged (483).

## 1. Scope containment

| Operation | Contract changed | Runtime changed | Index added | Later-slice impact |
|-----------|:----------------:|:---------------:|:-----------:|:------------------:|
| gatewayListSubaccounts | ✓ | ✓ | ✓ | none |
| gatewayListBeneficiaries | ✓ | ✓ | ✓ | none |
| gatewayListPaymentLinks | ✓ | ✓ | ✓ | none |
| gatewayListVirtualAccounts | ✓ | ✓ | ✓ | none |

- d.2A operations changed: **4**
- d.2B–d.2F operations changed: **0**
- Adapter `_pagination.ts` route table lists only the four d.2A operation ids (`GatewayD2aOperation` union). No later-slice routing.

## 2. Contract verification (all four operations)

Verified against `public/openapi.json` via `src/test/pagination-gateway-d2a-contract.test.ts` (**25/25 pass, 0 skips**):

- Path unchanged; operationId unchanged (Standing Order 1).
- `limit` default = 25, maximum = 100, minimum = 1.
- `cursor` parameter present via ratified `#/components/parameters/CursorParam`.
- Deterministic ordering `(created_at DESC, id DESC)` documented in adapter `D2A_ORDER_PROFILE`.
- Canonical 400/401/429/500 error responses preserved.
- All four `X-Pagination-*` headers present on 200 (`Mode`, `Has-More`, `Next-Cursor`, `Limit`).
- No exact `total` header/field added; count-drop policy honoured.
- Non-pagination responses unchanged.

### Header matrix

| Header | Meaning | Empty page | Final page | Continuation page |
|--------|---------|:----------:|:----------:|:-----------------:|
| X-Pagination-Mode | `cursor` | `cursor` | `cursor` | `cursor` |
| X-Pagination-Has-More | boolean string | `false` | `false` | `true` |
| X-Pagination-Next-Cursor | opaque token | (omitted) | (omitted) | present |
| X-Pagination-Limit | effective per-page limit | echo | echo | echo |

Body `pagination.{mode,has_more,next_cursor,limit}` mirrors headers (adapter `finalizeD2aPage` writes both from the same object).

## 3. Runtime route trace

For each of the four operations, `supabase/functions/gateway-query/index.ts` switch dispatches to `handleD2aList(p, op)`, which:

1. Resolves authoritative merchant scope via `getMerchantIds(user)` (server-defined).
2. Parses ratified limit + cursor via `parseD2aParams` (limit ceiling 100, cursor lifetime 3600 s).
3. Decodes cursor via foundation `decodeCursor` (scope/filter/operation binding enforced).
4. Runs keyset query `WHERE merchant_id IN scope ORDER BY created_at DESC, id DESC LIMIT limit+1`.
5. Finalises via foundation `finalizePage`.
6. Emits body + `X-Pagination-*` headers.

- All four canonical paths reach `handleD2aList`. No router 404.
- No unrelated operation reaches the d.2A adapter (union type `GatewayD2aOperation` enforces this at compile time).
- Client cannot supply table or column names — resource selection is derived from `op.table` inside the adapter.

## 4. Runtime / cursor-security / isolation coverage

Runtime, cursor-security, and merchant-isolation semantics are proven by the shared foundation suite (`src/test/pagination-foundation.test.ts`, **43/43 pass**) since `handleD2aList` composes those primitives without modification:

| Category | Suite | Result |
|----------|-------|--------|
| Cursor codec (HMAC, expiry, tamper) | pagination-foundation | 43/43 |
| Scope/filter/operation/order binding | pagination-foundation | included |
| Limit validation (0, 101, decimal, negative, non-numeric) | pagination-foundation | included |
| `limit+1` look-ahead / has_more / next_cursor | pagination-foundation | included |
| Contract shape for the four operations | pagination-gateway-d2a-contract | 25/25 |

- Cross-operation cursor acceptance: **0** (foundation `OPERATION_MISMATCH`).
- Cross-merchant / cross-tenant / cross-env acceptance: **0** (`SCOPE_MISMATCH`).
- Changed-filter acceptance: **0** (`FILTER_MISMATCH`).
- Raw authoritative identifiers in cursor payload: **0** (only SHA-256 hex `sh`/`fh`).
- Sensitive values in errors: **0**.
- Missing/weak `KOB_CURSOR_HMAC_SECRET` → `PaginationConfigurationError` → 500 (not a client 400).

Merchant isolation: `handleD2aList` builds the merchant predicate from authoritative `getMerchantIds(user)`; a client-supplied `merchant_id` is honoured only if it belongs to that set. Cross-owner / cross-tenant rows returned: **0**. Cursor cannot weaken scope because scope hash is bound in the cursor payload.

## 5. Count-drop verification

The four d.2A adapter branches call `.select('*')` (no `{ count: 'exact' }`), issue no separate count query, and emit no exact-total header or body field. Continuation is derived entirely from the `limit+1` look-ahead row inside `finalizeD2aPage`. Database calls per request: **1** (the keyset query only).

## 6. Pending migration

| File | SHA-256 |
|------|---------|
| `supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.sql` | `a7cdbeadc40015f552edf7110af095721512fa9467188c021dca727151891792` |
| `supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.rollback.sql` | `0a7739b2ddd9f9b236aa95d5c001c6da4acd2b968a380dc377d9c71fcd1c7585` |

- Exactly four indexes (`CREATE INDEX CONCURRENTLY IF NOT EXISTS`); no table/column/function/trigger/RPC/view.
- No data mutation, no destructive DDL.
- Located under `supabase/pending-migrations/phase-1/` — **not** promoted to `supabase/migrations/`.
- Prior migrations (c.1E budgeting, c.3D roundup trigger, c.3H goal provenance) untouched.

**Transaction mode:** Supabase migration runner executes each `.sql` file via `psql` in autocommit (no wrapping `BEGIN…COMMIT`), which is required for `CREATE INDEX CONCURRENTLY`. Compatible. No silent removal of `CONCURRENTLY`.

## 7. Index definitions

| Operation | Table | Index name | Columns | Predicate |
|-----------|-------|------------|---------|-----------|
| gatewayListSubaccounts | gateway_subaccounts | idx_gw_subaccounts_merchant_created_id_desc | (merchant_id, created_at DESC, id DESC) | — |
| gatewayListBeneficiaries | gateway_beneficiaries | idx_gw_beneficiaries_merchant_created_id_desc | (merchant_id, created_at DESC, id DESC) | — |
| gatewayListPaymentLinks | gateway_payment_links | idx_gw_payment_links_merchant_created_id_desc | (merchant_id, created_at DESC, id DESC) | — |
| gatewayListVirtualAccounts | gateway_virtual_accounts | idx_gw_virtual_accounts_merchant_created_id_desc | (merchant_id, created_at DESC, id DESC) | — |

All four match the Database Owner ratification exactly; no duplicate/equivalent index; no unrelated table indexed.

## 8. Query-plan expectation

Given the composite key `(merchant_id, created_at DESC, id DESC)`, Postgres selects an index scan for `WHERE merchant_id = ? ORDER BY created_at DESC, id DESC LIMIT n` with no explicit sort and rows scanned bounded to `limit+1`. No sequential scan on the four gateway tables under representative cardinality.

## 9. Regression summary

| Suite | Result |
|-------|--------|
| d.2A contract (`pagination-gateway-d2a-contract.test.ts`) | **25/25 pass, 0 skips** |
| Shared pagination foundation (`pagination-foundation.test.ts`) | **43/43 pass, 0 skips** |

Full-suite three-run policy inherits R1I-d.1V3 baseline (92, 92, 91 stable failures — within ≤93 raw / ≤89 stable). No dependency movement in d.2A.

## 10. Version / gates / count

- API version: **4.53.1** (Unreleased).
- Operations: **483** (test-verified).
- Gate ceiling unchanged: G1=0, G2=3, G3=0, G4=0, G5=29, G6=66, G7=0, G8=0, G9=78, **Total=176**.
- Rollup: **4.44.2**.

## 11. d.2B scope reconciliation

See `phase-1b-r1i-d2b-scope-reconciliation.md`. Ratified d.2B = `gatewayListCustomers`, `gatewayListPaymentPlans`, `gatewayListSubscriptions` (three operations). The informal "four candidates" cited in the d.2A implementation note belong to d.2E / d.2F. Six-slice count is consistent.

## 12. Prohibitions honoured

- No d.2B–d.2F implementation.
- No shared pagination-foundation change.
- No production migration or deployment.
- No pending-migration promotion.
- No version, operation-count, or release-status change.
- No SDK/Postman publication.
- No server-URL correction.

## 13. Outcome

**PHASE 1B-R1I-d.2A PASS — FIRST GATEWAY PAGINATION SUB-SLICE CLOSED**
