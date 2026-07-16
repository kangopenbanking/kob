# Phase 1B-R1I-b.1 — createGlobalAccount runtime idempotency (final report)

**Status: PASS — ELIGIBLE FOR b.2 REVIEW**
**Scope:** `POST /v1/gateway/global-accounts` (operationId `createGlobalAccount`) only.
**Version:** 4.53.1 (unchanged) · **Ops:** 484 (unchanged) · **Release:** Unreleased.

## Change surface

| Layer | File | Change |
| --- | --- | --- |
| Runtime handler | `supabase/functions/nium-create-global-account/index.ts` | Wired optional `Idempotency-Key` via shared helper. |
| Shared helper (new, pure) | `supabase/functions/_shared/integration-layer/canonical.ts` | Deterministic JSON serializer for fingerprints. |
| Tests | `src/test/create-global-account-idempotency-wiring.test.ts` | 14 wiring / policy guards. |

No migration. No new table. No RLS change. No OpenAPI change. No allowlist change.

## Idempotency controls

| Control | Implementation | Result |
| --- | --- | --- |
| Header optionality | Header absent → legacy path preserved. | PASS |
| Trusted scope | `{user_id (from JWT), method, route}` — never client-supplied. | PASS |
| Canonical fingerprint | `sha256(canonicalStringify({scope, body}))`; body = `{currency, pop_code, account_kind}`. | PASS |
| Atomic reservation | `reserveIdempotency()` — DB unique `(merchant_id, idempotency_key)` insert. | PASS |
| Completed replay | `idempotencyResponse()` emits cached body + `X-Idempotent-Replay: true`. | PASS |
| Changed-request conflict | 409 `IDEMPOTENCY_KEY_REUSED` (no body leakage). | PASS |
| In-flight duplicate | 409 `IDEMPOTENCY_KEY_IN_FLIGHT` + `Retry-After: 2`. | PASS |
| Provider ambiguity | Catch branch returns 502 **without** `storeIdempotency` — reservation expires (60s TTL) for safe retry / reconciliation. | PASS |
| Tenant isolation | Scope keyed on `userId`; identical keys across users are independent. | PASS |
| Second framework | None introduced (handler imports shared helper only). | PASS |

## Test summary

| Suite | Result |
| --- | --- |
| `create-global-account-idempotency-wiring.test.ts` (new, 14 tests) | 14/14 PASS |
| `openapi-quality-gates.test.ts` | 74/74 PASS |
| `openapi-phase-1b-contract.test.ts` | 19/19 PASS |
| `nium-webhook-contract-reconciliation.test.ts` | 15/15 PASS |

No test skipped by this slice. Contract ratchet (187 production-gate failures, 74 harness tests) preserved.

## Rollback

Revert commit; the change is additive and isolated to the two files above plus the new test. No data migration to reverse.

## Out of scope (per authorization)

- `updateGlobalAccountPayoutPreference` runtime wiring — reserved for b.2.
- Any production deploy / version bump / SDK publish.
