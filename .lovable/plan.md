
The user is quoting back the "Validation per wave" + "Out of scope" sections from the original Wave 1–4 plan. All four waves shipped. The natural next step they're signaling: actually execute the validation suite that was promised.

I'll propose a focused validation deliverable — not new features. This respects Standing Order 4 (additive, no behavior change) and closes the loop on what was promised.

Existing test seed: `supabase/functions/bank-data-router/index.test.ts` (CORS, auth gate, schema validation, adapter contracts). Need to extend to cover the four validation goals.

# Validation Suite — CEMAC Bank Integration (Waves 1–4)

Adds the test coverage the original plan committed to. Pure additive — no production code touched.

## Deliverables

### 1. Adapter unit tests (Deno)
New test files alongside each adapter:
- `_shared/bank-connectors/rest-bank.test.ts` — auth header injection, JSON array parsing, date-range query string, 4xx/5xx error mapping
- `_shared/bank-connectors/sql-bank.test.ts` — read-only enforcement (transfer rejected), parameterized query gateway POST shape, watermark filter
- `_shared/bank-connectors/file-bank.test.ts` — CSV parser, pain.001 XML parser, MT940 parser, transfer-rejected guard
- `_shared/bank-connectors/registry.test.ts` — all four adapter types resolvable, contract surface complete

### 2. E2E flows
- `bank-data-poller/index.test.ts` — auth gate, due-job picker shape, backoff math, per-op-type branching (transactions / balances / reconcile)
- `bank-reconcile-engine/index.test.ts` — auth + admin gate, report row created in `running` then `completed`, flag-only rule engine (zero auto-credit assertion)
- `bank-data-router/index.test.ts` — extend with failover ordering by `priority`, attempt audit row written on success and failure

### 3. Regression guard for `/v1/*`
- `tests/regression/v1-contract.test.ts` — snapshot the response shape of `/v1/aisp-accounts`, `/v1/aisp-transactions`, `mobile-money-charge` against fixtures committed in `tests/regression/fixtures/`. Fails on any field rename, removal, or type change. Enforces Standing Order 1 (The Lock).

### 4. Validation report
- `docs/bank-connectors/validation/wave-1-4-report.md` — pass/fail matrix per goal, citations to test files, manual verification checklist for items not auto-testable (e.g., synthetic webhook delivery to external URL).

## Out of scope (unchanged)
Bank-side ISO 20022 SOAP, cross-country failover, ML anomaly detection, per-user OAuth to bank portals.

## Test execution
All tests run via `supabase--test_edge_functions` after creation. Failures block report sign-off.

## Standing Orders compliance
- **Order 1 (Lock)**: regression suite enforces it
- **Order 4 (Surgeon)**: tests-only, zero production edits
- **Order 6 (Version Gate)**: no API change → no version bump needed
- **Order P5 (Working Code)**: every adapter example becomes an executable test
