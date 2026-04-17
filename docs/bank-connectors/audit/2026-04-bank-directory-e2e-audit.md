# /admin/bank-directory — E2E Audit (2026-04-17)

## Root cause of "Connection Test Failed"

The DB Connectors **Test** button always showed "Connection test failed" even when the test passed.

| Layer | Returned | UI checked | Result |
|---|---|---|---|
| `bank-db-connector.test_connection` | `{ reachable: true, ... }` | `d?.success` | `undefined` → false → red toast |
| `bank-api-connector.test_endpoint` | `{ reachable: true, ... }` | `d?.success` | same bug |

### Fix (additive, non-breaking — Standing Order 4)

1. Both edge functions now return `success: <boolean>` in addition to `reachable`.
2. `bank-db-connector.test_connection` now performs a **real HTTP probe** against `bridge_url` (5s timeout) when configured, instead of always returning a hardcoded `reachable: true`.
3. `bank-api-connector.test_endpoint` now uses an `AbortController` 5s timeout to avoid hangs.
4. UI toasts now show actionable detail: host, latency, probe error, or HTTP status.

No schema, path, or operationId changes — no API version bump required.

## Full E2E audit of `/admin/bank-directory`

| Tab | Backend fn | State | Notes |
|---|---|---|---|
| Banks | `bank-directory` | OK | CRUD + sandbox seed working |
| API Connectors | `bank-api-connector` | **Fixed** | Test now returns `success`; probe has timeout |
| DB Connectors | `bank-db-connector` | **Fixed** | Test now probes `bridge_url` when set; sandbox seed works |
| MQ Connectors | `bank-mq-connector` | OK | `test_broker` already returned `success` |
| File Imports | `bank-file-connector` | OK | Hash-dedupe + row-level traceability |
| Batch Payments | `bank-file-connector` | OK | Status-file ingestion wired |
| Reconciliation | `bank-reconcile-engine` | OK | Wave 5B matcher live |

### Remaining minor gaps (non-blocking)

- DB connector form does not yet expose `bridge_url` / `bridge_api_key` fields. Production users currently set these via direct SQL or API. Recommended follow-up: add an "Advanced → HTTP-to-SQL Bridge" section to the registration dialog (additive, optional).
- API connector `test_endpoint` assumes `paths.health` exists; falls back to `/health`. Banks without that path receive 404 → flagged as failed (correct behaviour).
- No automated alert when `consecutive_failures > 3` on either connector type — covered by Wave 5C retry queue / dead-letter, but no UI banner yet.

## Standing Orders compliance
- Order 1 (Lock): no rename/remove
- Order 4 (Surgeon): additive `success` field + real probe; existing `reachable` retained
- Order 6 (Version Gate): no API contract change → no bump
- Order P5 (Working Code): test surface now returns truthful results
