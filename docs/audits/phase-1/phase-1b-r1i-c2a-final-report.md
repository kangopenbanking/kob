# Phase 1B-R1I-c.2A — Final Report

**Slice:** `R1I-c.2A` — Budgeting DELETE response contract correction (contract-only).
**Predecessor:** `PHASE 1B-R1I-c.2 BLOCKED — CONTRACT RESPONSE DECISION REQUIRED` (see `phase-1b-r1i-c2-contract-block.md`).
**Related records:** `phase-1b-r1i-c2a-response-decision.md`, `phase-1b-r1i-c2a-contract-tests.md`.

## A. Response contract

| Operation | 204 | 400 | 401 | 403 | 404 | 409 | 500 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `budgetingDeleteBudget` | ✔ | ✔ | ✔ | — (Section 3 decision) | ✔ (masked) | ✔ | ✔ |
| `budgetingDeleteCategory` | ✔ | ✔ | ✔ | — (Section 3 decision) | ✔ (masked) | ✔ | ✔ |

`429 Too Many Requests` is also declared on both operations (consistent with every other state-mutating operation in the spec and required by Gate G6).

## B. Error semantics

| Scenario | Status | Problem code | Leakage-safe | Status |
| --- | --- | --- | --- | --- |
| Missing / invalid / expired auth | 401 | reusable `Unauthorized` | Yes | Documented |
| Malformed resource ID | 400 | `INVALID_RESOURCE_ID` | Yes | Documented |
| Malformed `Idempotency-Key` | 400 | `INVALID_IDEMPOTENCY_KEY` | Yes | Documented |
| Nonexistent resource | 404 | reusable `NotFound` | Yes | Documented |
| Cross-tenant / cross-owner resource | 404 | reusable `NotFound` (masked) | Yes | Documented in op.description |
| Protected system category | 409 | `SYSTEM_CATEGORY_PROTECTED` | Yes | Documented (category only) |
| Active dependency | 409 | `CATEGORY_HAS_ACTIVE_DEPENDENCIES` | Yes | Documented (category only) |
| Idempotency reuse | 409 | `IDEMPOTENCY_KEY_REUSED` | Yes | Documented |
| Idempotency in-flight | 409 | `IDEMPOTENCY_REQUEST_IN_PROGRESS` | Yes | Documented |
| Terminal-state replay | 204 | — | Yes (no repeated side effect) | Documented in op.description |
| Rate-limited | 429 | reusable `TooManyRequests` | Yes | Documented |
| Unexpected server failure | 500 | reusable `InternalServerError` | Yes | Documented |

## C. Contract tests

| Test class | Passed | Failed | Skipped |
| --- | --- | --- | --- |
| `openapi-phase-1b-c2a-contract.test.ts` (new) | 37 | 0 | 0 |
| `openapi-quality-gates.test.ts` (updated production-integrity assertion) | 74 | 0 | 0 |
| `openapi-phase-1b-contract.test.ts` (unchanged, re-run) | 19 | 0 | 0 |
| `openapi-problem-details-coverage.test.ts` (unchanged, re-run) | 3 | 0 | 0 |

No skips. No `.only` markers. No new tests bypassed.

## D. Gate delta

Executed: `npm run openapi:gates` on `public/openapi.json`.

| Gate | Before | After | Delta | Status |
| --- | ---: | ---: | ---: | --- |
| G1 (2xx schema) | 0 | 0 | 0 | Held at zero |
| G2 (webhook signature/dedupe) | 3 | 3 | 0 | Unchanged |
| G3 (financial-mutation idempotency) | 0 | 0 | 0 | Held at zero |
| G4 (list pagination) | 0 | 0 | 0 | Held at zero |
| G5 (RFC 7807 on 4xx/5xx) | 29 | 29 | 0 | Unchanged (reusable Problem Details refs used) |
| G6 (409+429 on mutations) | 76 | 72 | **−4** | Legitimate improvement (2 ops × 2 missing responses) |
| G7 (DELETE idempotency) | 0 | 0 | 0 | Held at zero |
| G8 (paginated cursor parity) | 0 | 0 | 0 | Held at zero |
| G9 (X-Request-ID) | 79 | 79 | 0 | Unchanged |
| **Total** | **187** | **183** | **−4** | Improved, no regression |

Policy compliance:
- No gate count increases.
- Total failures did not exceed 187.
- `G1, G3, G4, G7, G8` remain zero.
- No gate weakened, silenced, or added to any allow-list.

## E. Integrity

| Control | Expected | Actual | Status |
| --- | --- | --- | --- |
| Version | 4.53.1 | 4.53.1 | PASS |
| Operations | 484 | 484 | PASS |
| Release | Unreleased | Unreleased | PASS |
| Runtime handlers | Unchanged | Unchanged (no writes under `supabase/functions/**` or `src/**` runtime) | PASS |
| Database artifacts | Unchanged | Unchanged (no writes under `supabase/migrations/**` or `supabase/pending-migrations/**` SQL; canonical pending migration checksum `53a7228f…d0e76bf` unchanged) | PASS |
| SDK / Postman publication | None | None (no SDK regeneration, no Postman regeneration; publish scripts not invoked) | PASS |
| Deployment | None | None (no deployment workflow invoked) | PASS |

## F. Diff containment

Files changed this slice:

| File | Change | Justification |
| --- | --- | --- |
| `public/openapi.json` | Added 400/401/404/409/429/500 responses to `budgetingDeleteBudget` and `budgetingDeleteCategory`; added 2 category-specific Problem Details examples; refined 204 + operation descriptions | Section 2, Section 7, Section 8, Section 9 of the mandate |
| `public/openapi.yaml` | Regenerated from the updated JSON via `js-yaml` (same options as `scripts/sync-version-artifacts.mjs`) | Section 6 canonical source workflow |
| `scripts/slice-c2a-response-contract-patch.mjs` | New additive patch script with version + operation-count guardrails | Section 6 canonical workflow, reproducibility |
| `src/test/openapi-phase-1b-c2a-contract.test.ts` | New contract test file (37 assertions, 0 skips) | Section 10 mandatory contract tests |
| `src/test/openapi-quality-gates.test.ts` | Updated the single production-integrity assertion (187 → 183, G6 76 → 72) to reflect the legitimate gate improvement | Section 11 gate delta policy |
| `docs/audits/phase-1/phase-1b-r1i-c2a-response-decision.md` | New decision record | Section 14 required reports |
| `docs/audits/phase-1/phase-1b-r1i-c2a-contract-tests.md` | New contract-test report | Section 14 required reports |
| `docs/audits/phase-1/phase-1b-r1i-c2a-final-report.md` | This report | Section 14 required reports |
| `docs/audits/phase-1/phase-1b-r1i-c2-contract-block.md` | Header banner updated to note the block is now resolved by c.2A | Section 14 (update predecessor) |
| `docs/audits/phase-1/phase-1b-budgeting-delete-implementation-plan.md` | Updated to reference the corrected response contract | Section 14 (implementation plan) |

Explicitly not changed (prohibited by mandate):
- `supabase/functions/**`
- `supabase/migrations/**`
- `supabase/pending-migrations/**` SQL
- `src/**` runtime/application code
- `package.json`, `package-lock.json`
- SDK outputs (`packages/**`, generator output)
- Postman outputs (`public/postman/**`)
- Deployment workflows (`.github/workflows/**`)

## G. Command journal

```
node scripts/slice-c2a-response-contract-patch.mjs
npx vitest run src/test/openapi-phase-1b-c2a-contract.test.ts        # 37/37 PASS
npm run openapi:gates:test                                            # 74/74 PASS
npm run openapi:gates                                                 # 183 failures (was 187, -4 on G6)
npm run openapi:check-version                                         # OK 4.53.1
npm run version:check-sync                                            # OK 4.53.1
npm run version:print                                                 # 4.53.1
npx vitest run src/test/openapi-phase-1b-contract.test.ts src/test/openapi-problem-details-coverage.test.ts   # 22/22 PASS
```

## H. Acceptance gate

`PHASE 1B-R1I-c.2A PASS — BUDGETING DELETE RESPONSE CONTRACT RATIFIED`

Runtime handler implementation for `R1I-c.2` remains **not** authorised by this slice. The truthful response contract is now in place; runtime work requires a fresh authorization.
