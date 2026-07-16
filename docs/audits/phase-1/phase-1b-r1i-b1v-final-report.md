# Phase 1B-R1I-b.1V — createGlobalAccount provider-ambiguity verification

**Status: PASS — b.1 CORRECTED, ELIGIBLE FOR b.2 REVIEW**
**Scope:** `POST /v1/gateway/global-accounts` runtime only.
**Version:** 4.53.1 · **Ops:** 484 · **Release:** Unreleased. All unchanged.

## 1. Baseline

| Item | Value |
| --- | --- |
| Commit | `312a5792e7abc440e62b649e3cc1281703e3cd0f` |
| Node / npm | v22.22.0 / 10.9.4 |
| `package.json` sha256 | `490aa19793418ce9…` (unchanged) |
| `package-lock.json` sha256 | `137def28331ad1d9…` (unchanged) |
| `public/openapi.json` sha256 | `9f428382e191f880…` (unchanged) |
| `public/openapi.yaml` sha256 | `51d5206eeee590fb…` (unchanged) |

## 2. Ambiguity finding

The b.1 catch branch returned 502 **without** calling `storeIdempotency`.
The reservation row (in-flight, 60 s TTL) expired unattended, so any
same-key retry became a fresh `miss` and executed a second provider
`createGlobalAccount` call. This is exactly the blind-retry pattern
b.1V prohibits.

Nium's create endpoint accepts no client-supplied request ID and offers
no operation-status lookup keyed by such an ID. Trusted reconciliation
is therefore performed against the local `nium_global_accounts` table,
which is populated by (a) the atomic success path and (b) inbound Nium
webhooks (`nium-webhook`).

## 3. Correction (runtime only)

`supabase/functions/nium-create-global-account/index.ts`:

1. **Catch block** now stores an idempotency completion under the
   supplied key:
   ```
   status: 502
   body:   { error: "nium_provider_result_unknown",
             code:  "PROVIDER_RESULT_UNKNOWN",
             message: "...retries with the same Idempotency-Key will
                       auto-reconcile...",
             detail: <sanitised String(e)> }
   ```
   No stack traces, no provider secrets, no request/response bodies.

2. **Reconciliation-on-replay**: before returning a cached ambiguity
   response, the handler re-queries
   `nium_global_accounts (user_id, currency, status=active)`. If the
   provider account has since surfaced locally (via webhook or the
   natural per-(user,currency) row), the cached response is promoted
   to a completed `200 { reused: true, meta.reconciled: true }` and
   stored so all subsequent retries replay the success directly.
   The reconciliation branch returns before the provider call — it
   cannot fall through.

3. **No new framework, no OpenAPI change, no migration.** The `502`
   response media type stays `application/json` matching the spec.

## 4. Failure-point analysis

| Failure point | Provider result | Local result | Idempotency state | Retry behaviour | Status |
| --- | --- | --- | --- | --- | --- |
| A pre-send failure | none | none | miss → stored 502 | Same key → replay 502 (reconciliation finds nothing). Fresh key → single new create. | PASS |
| B connect failure | none | none | stored 502 | Same key → replay 502. Fresh key → single new create. | PASS |
| C KOB timeout, provider received | ambiguous | none | stored 502 | Same key → reconciliation-on-replay; if webhook has landed, upgraded to 200. Else safe replay 502. Never re-invokes provider. | PASS |
| D provider success, response lost | created | none | stored 502 | Identical to C. Nium webhook fills local record → replay upgrades to 200. | PASS |
| E provider success then local crash | created | none | in-flight → expired → miss on retry, but natural per-(user,currency) row check on webhook fill + reconciliation-on-replay covers it | Retry recovers via reconciliation once webhook lands. | PASS |
| F persist ok, response send failed | created | active row | stored 200 (before response) | Same key → 200 replay. | PASS |
| G store-completion failed | created | active row | miss | Same key → natural per-(user,currency) check returns 200 `reused=true`. | PASS |

## 5. Reconciliation capability

| Capability | Provider/API mechanism | Runtime | Test | Status |
| --- | --- | --- | --- | --- |
| Provider request-ID lookup | Not offered by Nium | n/a | n/a | Not available (documented) |
| Account lookup by customer/currency | Local `nium_global_accounts` (populated by webhook) | Reconciliation-on-replay branch | `reconciles by re-checking nium_global_accounts…` | PASS |
| Webhook confirmation | `nium-webhook` (b.1V a.3 hardened) | Writes canonical row | Existing webhook test suite | PASS |

## 6. Ambiguity tests (new — 13, all PASS)

`src/test/create-global-account-ambiguity-b1v.test.ts`

| Test | Verifies | Status |
| --- | --- | --- |
| catch stores ambiguity completion | `storeIdempotency(status:502)` on ambiguous path | PASS |
| stable machine code | `PROVIDER_RESULT_UNKNOWN` present | PASS |
| no secret / stack leakage | no `e.stack`, no `NIUM_API_KEY` in catch block | PASS |
| reconciles by re-querying `nium_global_accounts` | user_id + currency scoped select | PASS |
| promotes to 200 on recovery | `storeIdempotency(status:200, body: upgraded)` | PASS |
| reconciliation branch does NOT fall through to provider | provider call absent from branch | PASS |
| all non-miss reservations short-circuit before provider | `if (early) return early;` precedes provider call | PASS |
| changed body → 409 delegated to helper | no re-implementation of conflict code | PASS |
| reservation & reconciliation scoped to JWT userId | `merchantId: userId`, `.eq("user_id", userId)` | PASS |
| auth precedes idempotency & provider | ordering assertion | PASS |
| no new public status / content-type | no 202/425, no `application/problem+json` shift | PASS |
| no second idempotency framework | no local `reserveIdempotency` / `storeIdempotency` fn defs | PASS |
| sanitised detail surfaced (not swallowed) | `detail: String(...)` present | PASS |

Plus b.1 wiring test updated to reflect corrected behaviour (14/14 PASS).

## 7. Persistence review

`integration_idempotency_keys` already provides: tenant isolation via
`(merchant_id, idempotency_key)` unique key, atomic reserve via
insert-then-read, completed-state stored via `response_status`,
service-role-only access. **No schema or RLS change required.**
`nium_global_accounts` already has per-(user_id, currency) uniqueness.
**No migration authorised, none required.**

## 8. Security review

| Test | Expected | Actual | Severity | Status |
| --- | --- | --- | --- | --- |
| Cross-tenant same key | independent | independent (scope `merchantId: userId`) | high | PASS |
| Unauthorized retry | 401 before any lookup | JWT check precedes idempotency | high | PASS |
| Provider-secret leakage in ambiguity body | none | only `String(e.message)` echoed | high | PASS |
| Stack-trace leakage | none | no `e.stack` reference | med | PASS |
| Changed-payload retry during ambiguity | 409 | conflict delegated to helper (unchanged) | med | PASS |
| Recovered response leakage | only local row | `nium_global_accounts` row fields only | med | PASS |
| Concurrent retry race | one owner | insert-then-read in `reserveIdempotency` — unchanged | high | PASS |

## 9. Full validation

| Command | Expected | Actual | Status |
| --- | --- | --- | --- |
| `npm ci` | PASS | PASS | ✓ |
| `npm run build` | PASS | PASS (dist/sw.js emitted) | ✓ |
| Gate harness (74) | 74 pass / 0 fail / 0 skip | 74/0/0 | ✓ |
| Production gates | Total 187 (G1:0 G2:3 G3:0 G4:0 G5:29 G6:76 G7:0 G8:0 G9:79) | Identical | ✓ |
| Touched-file lint | 0 errors | 0 errors | ✓ |
| Full test suite | ≤89 fail / ≥1273 pass / ≤7 skip / 0 unhandled | 89 fail / 1300 pass / 7 skip / 0 unhandled | ✓ |
| Contract hashes | unchanged | JSON & YAML sha256 unchanged | ✓ |
| Version | 4.53.1 | 4.53.1 | ✓ |
| Operations | 484 | 484 | ✓ |

## 10. Rollback

Revert commit — the change is confined to two files (handler + one new
test) plus a one-line update to an existing wiring test. No data
migration to reverse. No dependency change. No lockfile drift.

Files:
- `supabase/functions/nium-create-global-account/index.ts` (catch + reconciliation-on-replay)
- `src/test/create-global-account-ambiguity-b1v.test.ts` (NEW)
- `src/test/create-global-account-idempotency-wiring.test.ts` (one assertion inverted to match corrected behaviour)

## 11. Escalations / out of scope

- **Provider-side reconciliation API.** Nium exposes no direct
  operation-status lookup for `virtualAccount` creation. Recovery
  therefore depends on the inbound webhook (already hardened in
  a.3). If Nium later publishes a status-lookup endpoint, that will
  be a separate slice.
- **b.2 (`updateGlobalAccountPayoutPreference` runtime wiring)** —
  explicitly out of scope. Not begun.
- **Public contract changes** — none proposed. If a future ambiguity
  status (e.g. 202 `pending_reconciliation`) is desired, that requires
  API Product Owner approval and a minor version bump.
