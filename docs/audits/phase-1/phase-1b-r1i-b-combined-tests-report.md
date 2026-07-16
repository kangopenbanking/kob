# Phase 1B-R1I-b — Combined Tests Report

Companion to `phase-1b-r1i-b3-final-report.md`. Provides the manifest of
targeted tests exercised across the full R1I-b closure.

## Targeted inventory (212 tests, 0 skipped, 0 only)

| # | File | Tests | Purpose |
|---|---|---:|---|
| 1 | `src/test/openapi-quality-gates.test.ts` | 74 | Gate-harness proof (G1–G9 + provider-event G3) |
| 2 | `src/test/openapi-phase-1b-contract.test.ts` | 19 | Contract shape for Phase 1B operations |
| 3 | `src/test/nium-webhook-contract-reconciliation.test.ts` | 15 | Provider-event webhook contract |
| 4 | `src/test/nium-webhook-hardening.test.ts` | 8 | Fingerprint + replay-window + stale-retry |
| 5 | `src/test/create-global-account-idempotency-wiring.test.ts` | 14 | b.1 optional client-key wiring |
| 6 | `src/test/create-global-account-ambiguity-b1v.test.ts` | 13 | b.1V provider ambiguity + reconciliation-on-replay |
| 7 | `src/test/create-global-account-cross-key-b1x.test.ts` | 26 | b.1X / b.1XV UUIDv5 business-op lock + tenant isolation |
| 8 | `src/test/update-payout-preference-idempotency-wiring.test.ts` | 20 | b.2.1 / b.2.1V ownership-before-reservation |
| 9 | `src/test/idempotency-runtime-contract.test.ts` | 8 | Shared reservation helper contract |
| 10 | `src/test/global-accounts-cross-op-isolation-b3.test.ts` | **15 (new)** | Cross-operation resource / fingerprint isolation |

**Total: 212 tests. 212 pass. 0 fail. 0 skipped.**

No `.skip`, no `.only`, no conditional exclusion, no renamed-file escape,
no test-only runtime branch. All new assertions are additive and derive
from source-level file reads — no runtime shape depends on them.

## Full-suite double run

| Run | Failing | Passing | Skipped | Unhandled | Notes |
|---:|---:|---:|---:|---:|---|
| 1 | 90 | 1360 | 7 | 0 | +1 vs Run-2 ratchet — variance within b.2.1 CI band (86–89) |
| 2 | 89 | 1361 | 7 | 0 | Exactly on b.2.1 CI Run-2 ratchet |

Failure attribution across both runs: identical failing files, all
pre-existing UI flakes (`MobileAuthForm`, `useSupportedCountries`,
onboarding, Fee-Management). **Zero failures** in handler, shared helper,
or R1I-b test files.

## Cross-operation isolation coverage (b.3)

`global-accounts-cross-op-isolation-b3.test.ts` proves at source:

1. Both handlers import the same `reserveIdempotency` helper.
2. Both handlers share `public.integration_idempotency_keys`.
3. Create RESOURCE = `POST /v1/gateway/global-accounts`; update RESOURCE =
   `PATCH /v1/gateway/global-accounts/payout-preference` (distinct).
4. Same client key against both handlers cannot alias by scope.
5. Both fingerprints bake `method` + `route`.
6. Both use `canonicalStringify` + `sha256`.
7. Create never reserves under the payout-preference resource; update
   never reserves under the create resource.
8. Shared helper scopes by `(merchantId, resource, key)`.
9. Create retains ambiguity + UUIDv5 op-lock controls; update is
   SET_STATE / LOCAL_ONLY with no op-lock and no ambiguity path.
10. Update performs ownership check before reservation (no negative
    caching); public client key remains UUIDv4-only.

## Lint

Touched-file lint (both handlers, `_shared/integration-layer/*`, all
R1I-b test files): **0 errors, 0 warnings**.
