# Phase 1B-R1I-c.2B — Compatibility Report

## Existing callers — all pass targeted regression (115/115)

| Suite | Result |
|---|---|
| `src/test/idempotency-contract.test.ts` | ✅ 3/3 |
| `src/test/idempotency-runtime-contract.test.ts` | ✅ 8/8 |
| `src/test/idempotency-204-bodyless.test.ts` (new) | ✅ 8/8 |
| `src/test/create-global-account-idempotency-wiring.test.ts` | ✅ pass |
| `src/test/create-global-account-cross-key-b1x.test.ts` | ✅ pass |
| `src/test/create-global-account-ambiguity-b1v.test.ts` | ✅ pass |
| `src/test/update-payout-preference-idempotency-wiring.test.ts` | ✅ pass |
| `src/test/global-accounts-cross-op-isolation-b3.test.ts` | ✅ pass |
| `src/test/nium-webhook-hardening.test.ts` | ✅ pass |
| **Total** | **115/115 passed, 0 failed, 0 skipped** |

## Non-204 JSON responses — unchanged

| Status | Serialisation | Content-Type | Confirmed |
|---|---|---|---|
| 200 | `JSON.stringify(body)` | `application/json` | ✅ unchanged branch |
| 201 | `JSON.stringify(body)` | `application/json` | ✅ unchanged branch |
| 202 | `JSON.stringify(body)` | `application/json` | ✅ unchanged branch |
| 400 | `JSON.stringify(body)` | `application/json` | ✅ unchanged branch |
| 409 (conflict envelope) | `JSON.stringify({error})` | `application/json` | ✅ unchanged |
| 500 | `JSON.stringify(body)` | `application/json` | ✅ unchanged branch |

## Existing stored-record compatibility

- No historical row has `response_status = 204` (no caller stored 204 pre-c.2B).
- Existing rows with object bodies replay identically: `hasBody:true` branch takes the unmodified JSON path.
- No data rewrite, no backfill, no downtime.

## Scope / isolation / fingerprint

Unchanged. `reserveIdempotency`'s tenant scope (`merchant_id + idempotency_key`), request-hash conflict detection, in-flight TTL and stale-reservation reclaim are all outside the c.2B diff.

---

## c.2B-V re-confirmation

Post-clean-install re-run of all nine caller suites: 115/115 pass, 0 skipped. Lockfile hash unchanged (`137def28…c7a5`). Rollup unchanged (4.44.2). Vite unchanged (5.4.21). OpenAPI JSON/YAML unchanged. Budgeting DELETE handlers still unimplemented. Gate total remains 183.
