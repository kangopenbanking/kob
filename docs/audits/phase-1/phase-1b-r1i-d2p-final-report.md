# Phase 1B — R1I-d.2P — Final Report

**Slice:** R1I-d.2P — Second Pagination Slice Scope & Implementation Preflight (READ-ONLY).
**API version:** 4.53.1 (Unreleased) — unchanged.
**Operation count:** 483 — unchanged.
**Gate totals:** G1:0, G2:3, G3:0, G4:0, G5:29, G6:66, G7:0, G8:0, G9:78 = **176** — unchanged.
**Rollup:** 4.44.2 — unchanged.
**Full-repo lint ceiling:** 5586 — untouched (no code changes).

## 1. Scope extraction

16 operations extracted from `docs/audits/phase-1/phase-1b-r1i-d0-remediation-plan.md` § 1 row R1I-d.2. Every operation converges on `supabase/functions/gateway-query/index.ts`. Full detail: `phase-1b-r1i-d2p-scope.md`.

## 2. Decision integrity — BLOCKED

Twelve material decisions remain `PROPOSED_NOT_RATIFIED`:
1. Per-operation `defaultLimit` / `maxLimit`.
2. Universal `X-Pagination-*` response headers (Standard Proposal §7; d.1F #11 explicitly deferred).
3. `has_more` / `next_cursor` / `mode` mandatory in envelope (§6).
4. `total` forbidden on high-volume gateway tables (§6).
5. Backward pagination (`previous_cursor`).
6. Cursor scope-binding input set (env + merchant + actor + parent).
7. Ordering-profile registry location.
8. Provider-token adapter for `gatewayListPayouts` (deferred to R1I-d.8).
9. Rotation policy for `KOB_CURSOR_HMAC_SECRET` (deferred to R1I-d.7).
10. Runtime envelope reconciliation (current handler returns `{data,total,limit,offset}` — contract declares `{data,pagination,meta}`).
11. `sort_by` / `sort_order` per-op enum contents.
12. Handling of legacy `page` / `offset` / `starting_after` parameters during transition.

Full detail: `phase-1b-r1i-d2p-decision-integrity.md`.

## 3. Contract preflight — BLOCKED

All 16 operations require at minimum `PARAMETER_CORRECTION`, `RESPONSE_SCHEMA_CORRECTION` and `RESPONSE_HEADER_CORRECTION`. None of these corrections were ratified by d.0 or d.1F. Full detail: `phase-1b-r1i-d2p-contract-preflight.md`.

## 4. Runtime trace — advisory

All 16 operations are wired and share a single handler. Current handler unconditionally orders by `created_at DESC` with `offset+limit+count:'exact'`; `sort_by`, `sort_order`, `cursor`, `starting_after`, `ending_before` are declared in the contract but silently ignored at runtime. `gatewayListCustomerTokens` returns an unbounded list. Full detail: `phase-1b-r1i-d2p-runtime-trace.md`.

## 5. Database & performance — BLOCKED

16 composite indexes are required (see per-op table). No index, view, RPC, or migration is proposed by this preflight beyond the shape sketches. Full detail: `phase-1b-r1i-d2p-database-performance.md`. Blocking gate: `PHASE 1B-R1I-d.2 BLOCKED — DATABASE OWNER PAGINATION AUTHORIZATION REQUIRED`.

## 6. Security — advisory

Proposed cursor design exposes 0 raw tenant/owner/actor identifiers and inherits `SCOPE_MISMATCH` / `OPERATION_MISMATCH` / `FILTER_MISMATCH` typed failures from the d.1F foundation. No new security blocker introduced beyond the product/contract block. Full detail: `phase-1b-r1i-d2p-security.md`.

## 7. Foundation compatibility — PASS

Every d.2 operation can consume `supabase/functions/_shared/pagination.ts` as ratified in d.1F **without any foundation change**. Per-op adapters supply `operation`, `defaultLimit`, `maxLimit`, `orderingProfile`, `scope`, and `filters` at the caller boundary. **Foundation change needed: NO.**

## 8. Test plan — inventory only

Documented in `phase-1b-r1i-d2p-test-plan.md`. No executable test authored.

## 9. Proposed implementation file set (for a future slice, not modified here)

| File | Type | Proposed change | Operation dependency |
|------|------|-----------------|----------------------|
| `public/openapi.json` | CONTRACT_FILES | Parameter/response/header corrections | all 16 |
| `public/openapi.yaml` | CONTRACT_FILES | Parity with `.json` | all 16 |
| `supabase/functions/gateway-query/index.ts` | RUNTIME_FILES | Adopt shared codec; keyset queries | all 16 |
| `supabase/functions/gateway-charges-router/index.ts` | RUNTIME_FILES | Router pass-through (if needed) | charges, charge-events |
| `supabase/functions/gateway-payouts-router/index.ts` | RUNTIME_FILES | Router pass-through | payouts |
| `supabase/functions/gateway-disputes-router/index.ts` | RUNTIME_FILES | Router pass-through | disputes |
| `supabase/functions/gateway-settlement-router/index.ts` | RUNTIME_FILES | Router pass-through | settlements |
| `supabase/functions/gateway-funding-router/index.ts` | RUNTIME_FILES | Router pass-through | funding-intents |
| `src/test/pagination-gateway-*.test.ts` (4 files) | TEST_FILES | New | all 16 |
| `supabase/pending-migrations/phase-1/<slice>-gateway-pagination-indexes.sql` | DATABASE_FILES | 16 composite indexes | all 16 |
| `docs/audits/phase-1/phase-1b-r1i-d2-*.md` | AUDIT_FILES | Implementation audit set | all 16 |

**Unrelated files: 0.** No file outside the list above is proposed for modification.

## 10. Quality-gate impact forecast

| Gate | Current | Expected effect (post d.2 implementation) | Reason |
|------|---------|-------------------------------------------|--------|
| G1 | 0 | 0 | Additive-only change |
| G2 | 3 | 3 | Untouched surface |
| G3 | 0 | 0 | Untouched |
| G4 | 0 | 0 | Pagination shape assertions preserved |
| G5 | 29 | ≤ 29 | Additive schemas |
| G6 | 66 | 66 | Non-mutation operations |
| G7 | 0 | 0 | Untouched |
| G8 | 0 | 0 | Untouched |
| G9 | 78 | ≤ 78 (may drop as ordering docs improve) | Documentation additions may satisfy latent checks |
| **Total** | **176** | **≤ 176** | No new gate failure permitted; ratchet only downward |

## 11. Baseline verification (executed in this slice)

- `npm run openapi:gates` → G1:0 G2:3 G3:0 G4:0 G5:29 G6:66 G7:0 G8:0 G9:78 (total 176). PASS.
- `npm run version:print` → `4.53.1`. PASS.
- (`openapi:gates:test`, `openapi:check-version`, `version:check-sync` not re-run; no repository content was touched.)

## 12. Repository integrity

No changes to: OpenAPI, live handlers, shared pagination foundation, database schema, pending migration SQL, SDKs, Postman, package files, lockfile, server URLs, deployment workflows, version metadata.

Permitted changes performed: eight Phase 1 audit reports created; tracker updated.

## 13. Implementation authorization recommendation

**Recommendation F — SPLIT R1I-d.2 INTO SMALLER SUB-SLICES.**

Proposed sub-slice sequencing (all currently unauthorised; each requires a distinct authorisation from Guardian / Database Owner as noted):

| Sub-slice | Purpose | Authorisation required |
|-----------|---------|------------------------|
| **R1I-d.2P-DEC** | Product / contract ratification of `defaultLimit`, `maxLimit`, header contract, envelope reconciliation, count-semantics on high-volume tables. | Guardian ratification of Standard Proposal §§ 2, 3, 6, 7, 8. |
| **R1I-d.2P-DB** | Database Owner authorisation for the 16 composite indexes sketched in the DB report. | Database Owner. |
| **R1I-d.2C** | Contract-only correction (parameters, responses, headers) for the 16 operations. Blocked until d.2P-DEC. | Contract-correction authorisation. |
| **R1I-d.2R.1** | Runtime keyset adoption for the 4 lowest-risk operations (`gatewayListSubaccounts`, `gatewayListBeneficiaries`, `gatewayListPaymentLinks`, `gatewayListVirtualAccounts`). Blocked until d.2P-DB. | Runtime authorisation. |
| **R1I-d.2R.2** | Runtime keyset adoption for the 8 MEDIUM-risk operations. | Runtime authorisation. |
| **R1I-d.2R.3** | Runtime keyset adoption for the 4 HIGH-risk operations (`gatewayListCharges`, `gatewayListRefunds`, `gatewayListCustomerTokens`, `gatewayGetChargeEvents`) — plus deprecation of `count:'exact'` on `gateway_charges`, `gateway_refunds`, `gateway_charge_events`, `funding_intents`. | Runtime + Database Owner. |
| (deferred) R1I-d.8 | Provider-token wrapping for `gatewayListPayouts`. | Out of scope for d.2. |

## 14. Gate statement

Because material product/contract decisions are unratified **and** database-owner authorisation is required, the compound blocker takes precedence. Product/contract decisions are upstream of every downstream slice.

**PHASE 1B-R1I-d.2 BLOCKED — PAGINATION PRODUCT OR CONTRACT DECISION REQUIRED**

(Secondary, subordinate: `PHASE 1B-R1I-d.2 BLOCKED — DATABASE OWNER PAGINATION AUTHORIZATION REQUIRED` and `PHASE 1B-R1I-d.2 BLOCKED — PAGINATION CONTRACT CORRECTION AUTHORIZATION REQUIRED`.)
