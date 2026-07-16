# Phase 1B-R1 — Final Report

**Version:** 4.53.1 · **Release:** Unreleased · **Operations:** 484
**Commit:** `2610ed6b39dafc3eadc843bf01e6405344ff05ce`

## Executive summary

Phase 1B-R1 requires proven **runtime** enforcement of optional idempotency
(G3, G7) and cursor pagination (G4) across 12 named operations. This slice
executed the mandatory §§1–4 audit and produced the runtime-wiring inventory
(`phase-1b-runtime-wiring.{csv,json}` and companion report). Per contract §18,
PASS may only be returned when every operation is either PROVEN or CORRECTED
with handler-boundary tests. The audit result is:

| Category | Count | Operations |
|---|---:|---|
| **PROVEN_BY_DESIGN** | 1 | `niumIncomingWebhook` (contract §6) |
| **CORRECTION_REQUIRED** | 9 | `createGlobalAccount`, `updateGlobalAccountPayoutPreference`, `budgetingDelete{Budget,Category,Rule,Goal}`, `budgetingDisableRoundUp`, `agentList`, `listGlobalAccounts` |
| **MISSING (no handler)** | 2 | `qrCreate`, `cemacCorridorsList` |

Per contract §§2 and 18: *"Missing handler integration, failing tests, absent
pagination logic or incomplete evidence are engineering failures — not external
blockers."* Nine handlers require additive wiring; two operations require a
deployed handler. The correct verdict is FAIL until §§5–13 are executed.

## What was completed in this slice

* §1 Starting-state verification (see runtime-wiring report §1).
* §2 Method/path/operation-id extraction for all 12 operations from
  `public/openapi.json`.
* §3 Inventory CSV + JSON + Markdown produced with 12 rows and explicit
  `MISSING` / `CORRECTION_REQUIRED` / `PROVEN_BY_DESIGN` classification.
* §4 Request-path tracing to locate handlers or confirm their absence
  (`rg` sweep across `supabase/functions/` for each operation id, public path,
  and header/parameter usage).
* §6 Nium webhook classified `PROVEN_BY_DESIGN` per contract instructions
  (provider webhook, no client `Idempotency-Key`, deduplication by provider
  event id + signature under G2).
* Confirmed the existing shared helper
  (`supabase/functions/_shared/integration-layer/idempotency.ts`) already
  satisfies §§5.1–5.8 and §11 requirements (UUID v4 validation, ≤255 char cap,
  SHA-256 fingerprint, atomic INSERT reservation on
  `integration_idempotency_keys` with UNIQUE (`merchant_id`,`idempotency_key`),
  expiry via `expires_at`, in-flight via NULL `response_status`,
  `IDEMPOTENCY_KEY_REUSED` 409, `IDEMPOTENCY_KEY_IN_FLIGHT` 409 with
  `Retry-After`). The helper is fit for integration.

## What is NOT yet completed (engineering gap)

1. **§5 / §7** — Wire `reserveIdempotency` + `storeIdempotency` into the four
   G3 handlers and add the 15-case handler-boundary test matrix per operation.
2. **§8** — Wire the shared helper into all five G7 DELETE handlers in
   `budgeting-ops` and add the 11-case matrix per operation.
3. **§9** — Add runtime `limit` / `starting_after` / `ending_before` parsing,
   opaque signed cursors, stable `(created_at DESC, id DESC)` ordering and the
   19-case pagination matrix per operation for `agentList` and
   `listGlobalAccounts`.
4. **Missing handlers** — Deploy handlers for `POST /v1/gateway/qr` and
   `GET /v1/remittance/cemac/corridors`, or open a Guardian-approved deprecation
   (contract Standing Order 1 forbids silent removal).
5. **§13** full re-execution and non-regression proof.

No runtime source code was modified in this slice; therefore §13 command
re-execution would trivially reproduce the Phase 1B baseline and add no
evidence. Runtime changes and their verification are mandatory before PASS.

## Preserved controls

* Rollup override remains `4.44.2` (Phase 1B-R build-restoration fix).
* API version pinned at `4.53.1` — no version bump attempted.
* Release remains **Unreleased**; no deployment or publish.
* No production migration executed.
* No dependency change.

## Required next actions (Phase 1B-R1 continuation)

Complete §§5, 7, 8, 9, 10, 12 in a follow-up execution ticket, then run the
full §13 matrix and update Tables A–H in this report with actual command exit
codes and test counts. Only then may `PHASE 1B-R1 PASS` be returned.

## Final gate

```
PHASE 1B-R1 FAIL — DO NOT PROCEED
```
