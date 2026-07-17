# Phase 1B — R1I-d.2A — Scope

**Slice**: R1I-d.2A — First Gateway pagination sub-slice
**Source of truth**: `phase-1b-r1i-d2s-operation-groups.md`, `phase-1b-r1i-d2s-pagination-decisions.md`

## 1. Ratified operation matrix (exactly 4)

| # | operationId | Method | Public path | Gateway resource | Default | Max | Cursor lifetime (s) |
|---|-------------|--------|-------------|------------------|---------|-----|---------------------|
| 1 | gatewayListSubaccounts | GET | /v1/gateway/subaccounts | gateway_subaccounts | 25 | 100 | 3600 |
| 2 | gatewayListBeneficiaries | GET | /v1/gateway/beneficiaries | gateway_beneficiaries | 25 | 100 | 3600 |
| 3 | gatewayListPaymentLinks | GET | /v1/gateway/payment-links | gateway_payment_links | 25 | 100 | 3600 |
| 4 | gatewayListVirtualAccounts | GET | /v1/gateway/virtual-accounts | gateway_virtual_accounts | 25 | 100 | 3600 |

- Operations assigned to d.2A: **4** ✓
- Duplicate assignments: **0** ✓
- d.2B–d.2F operations included: **0** ✓

## 2. Ordering / scope / filter binding

| operationId | Ordering profile | Scope-hash inputs | Filter-hash inputs | Public metadata |
|-------------|------------------|-------------------|--------------------|-----------------|
| gatewayListSubaccounts | `(created_at DESC, id DESC)` | env, op, actor.sub, merchant_scope | `{}` | data, pagination.{mode,has_more,next_cursor,limit} |
| gatewayListBeneficiaries | idem | idem | `{is_active:true}` | idem |
| gatewayListPaymentLinks | idem | idem | `{slug?}` | idem |
| gatewayListVirtualAccounts | idem | idem | `{account_kind?}` | idem |

## 3. Diff containment

Authorised files touched by d.2A:

- `public/openapi.json` — additive corrections to 4 operations only (cursor param, X-Pagination-* headers, limit default/maximum).
- `public/openapi.yaml` — same 4 operations, mirrored via `js-yaml.dump` (established precedent — see `scripts/patch-openapi-nium-va.mjs`).
- `supabase/functions/gateway-query/index.ts` — 4 switch branches rewired to `handleD2aList` + one keyset-pagination function appended.
- `supabase/functions/gateway-query/_pagination.ts` — new local helper composing `_shared/pagination.ts` primitives.
- `supabase/pending-migrations/phase-1/20260401000000_phase-1b-r1i-d2a-gateway-pagination-indexes.{sql,rollback.sql}` — 4 approved composite indexes.
- `scripts/slice-d2a-gateway-pagination-contract.{mjs,-yaml.mjs}` — patch scripts (reproducible).
- `docs/audits/phase-1/phase-1b-r1i-d2a-*.md` — 10 reports.
- `src/test/pagination-gateway-d2a-*.test.ts` — d.2A test suites.

Prohibited touched: **0** (shared foundation, package files, server URLs, deployment workflows all unchanged).

## 4. Foundation compatibility

`supabase/functions/_shared/pagination.ts` unchanged — all d.2A behaviour composes public primitives (`encodeCursor`, `decodeCursor`, `parsePaginationLimit`, `finalizePage`, `hashScope`, `hashFilters`).
