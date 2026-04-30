# Phase 6 — E2E Tests (CI Gate)

**Spec version**: 4.22.0 (no spec change in Phase 6 — tests only)
**Standing Orders cited**: SO-2 (Ratchet), SO-7 (Five Roles); P5 (Working Code), P10 (Living Docs)
**Date**: 2026-04-30

## Scope

Phase 6 implements end-to-end tests in CI for the five mandated areas:

1. **Provider webhook ingestion** — `src/test/phase6-provider-webhook-ingestion.test.ts`
   - Stripe: signed sample event → `gateway_charges.status` update; missing/invalid signatures → 401; dedupe via `webhook_inbox`.
   - Flutterwave: `verif-hash` → state update; mismatched hash → 401; dedupe.
   - PayPal: signature verification mocked → state update; missing headers / verification failure → 401; dedupe.

2. **Merchant lifecycle** — `src/test/phase6-merchant-lifecycle.test.ts`
   - KYB submit (owner-only) → admin review (admin-only) → approved → merchant `ACTIVE`.
   - Rejected merchant can resubmit and be approved.
   - Keys cannot be issued before `ACTIVE`.
   - Key rotation: old key valid during 24h grace, invalid after grace expiry.

3. **Merchant outbound webhooks** — `src/test/phase6-merchant-outbound-webhooks.test.ts`
   - Create endpoint → trigger event → delivery row written.
   - Successful delivery → `status=delivered`, `last_response_code=200`.
   - Failing endpoint → `status=pending`, attempts incremented, retry scheduled.
   - Replay of a delivered event → produces fresh pending delivery row that re-delivers.
   - Replay of unknown event id → 404.
   - Inactive endpoints do not receive events.

4. **Contract tests** — `src/test/phase6-contract.test.ts`
   - Both `public/openapi.json` and `public/openapi-sandbox.json` parse.
   - Every operation declares ≥1 `2xx` response.
   - Every `2xx` response (except `204`) declares a JSON content schema.
   - Companion ratchet files (`openapi-2xx-schema-coverage`, `-operation-id-uniqueness`, `-security-declared`, `-pagination-coverage`, `-error-catalog-coverage`, `-idempotency-coverage`) are wired into the same CI job.

5. **Dashboard UI E2E (smoke)** — `src/test/phase6-dashboard-routes.test.tsx`
   - Merchant pages: `MerchantKYB`, `MerchantApiKeys`, `MerchantWebhooks`, `MerchantSettlements` — modules load + default export is a component.
   - Admin pages: KYB review queue, webhook monitoring, reconciliation mismatch queue — at least one candidate path per page must resolve, preventing silent route removal.

## CI Workflow

`.github/workflows/phase6-e2e.yml` runs on every PR + push to `main`:

- Job `e2e` installs deps with `bun`, runs the five Phase 6 suites, then runs the six companion OpenAPI ratchet suites. The job blocks merge on any failure (Standing Order 2 — The Ratchet).

## Coverage Mapping

| Area                                | Test file                                            | Production source(s) it locks                                                                        |
| ----------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Stripe webhook                      | `phase6-provider-webhook-ingestion.test.ts`          | `gateway-webhook-stripe/index.ts`                                                                    |
| Flutterwave webhook                 | `phase6-provider-webhook-ingestion.test.ts`          | `gateway-webhook-flutterwave/index.ts`, `flutterwave-transfer-webhook/index.ts`                      |
| PayPal webhook                      | `phase6-provider-webhook-ingestion.test.ts`          | `gateway-webhook-paypal/index.ts`                                                                    |
| KYB submit + admin review           | `phase6-merchant-lifecycle.test.ts`                  | `gateway-merchant-kyb/index.ts`, `gateway-merchant-kyb-review/index.ts`                              |
| Key issue / rotate / grace          | `phase6-merchant-lifecycle.test.ts`                  | `gateway-merchant-keys/index.ts`                                                                     |
| Outbound webhook CRUD + delivery    | `phase6-merchant-outbound-webhooks.test.ts`          | `gateway-merchant-webhooks/index.ts`, `gateway-deliver-webhook/index.ts`                             |
| Outbound webhook replay             | `phase6-merchant-outbound-webhooks.test.ts`          | `gateway-webhook-replay-delivery/index.ts`                                                           |
| OpenAPI parse + 2xx schema coverage | `phase6-contract.test.ts`                            | `public/openapi.json`, `public/openapi-sandbox.json`                                                 |
| Merchant + admin dashboard pages    | `phase6-dashboard-routes.test.tsx`                   | `src/pages/merchant/*`, `src/pages/admin/*`                                                          |

## Justification Citations

- **Standing Order 2** — These tests ratchet behavior: any future PR that breaks signature verification, dedup, or 2xx schema coverage must update both the test and the audit trail before merge.
- **Order P5** — Phase 6 is the automation that enforces "every code example must work against the sandbox": if the contract drifts, ingestion + lifecycle + outbound suites fail.
- **Order P10** — This audit doc is the change-log entry for the Phase 6 release.

## Files Created

- `src/test/phase6-provider-webhook-ingestion.test.ts`
- `src/test/phase6-merchant-lifecycle.test.ts`
- `src/test/phase6-merchant-outbound-webhooks.test.ts`
- `src/test/phase6-contract.test.ts`
- `src/test/phase6-dashboard-routes.test.tsx`
- `.github/workflows/phase6-e2e.yml`
- `docs/audits/phase-6-e2e-tests.md`
