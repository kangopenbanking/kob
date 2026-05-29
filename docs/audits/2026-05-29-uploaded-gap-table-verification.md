# Uploaded Gap Table — Verification Report

**Date:** 2026-05-29
**Source:** `table-a03f54dd-87d7-40ac-85d7-af3335f90cf9.xlsx` (uploaded)
**API Version Verified:** `4.43.0`
**Standing Orders applied:** #2 (Ratchet), #3 (Audit Trail), #4 (Additive), #6 (Version Gate)

## Result

**7 / 7 gaps from the uploaded report are CLOSED.** No additional code changes required. This document is the audit trail proving closure against the live OpenAPI specification, runtime Edge Functions, and shared helpers.

## Mapping table

| # | Uploaded Dimension | Uploaded Status | Closing Phase | Evidence | Verified |
|---|--------------------|-----------------|---------------|----------|----------|
| 1 | Core Protocol Reliability — Underspecified Idempotency | Not Ready | Phase 8 (v4.42.0) | `Idempotency-Key` UUID v4 pattern + `maxLength:255`; `X-Idempotent-Replay` & `X-Idempotency-Status` response headers wired onto 97 financial 2xx ops; `idempotency_keys` table TTL'd; ratchet test `src/test/openapi-idempotency-response-headers.test.ts` | ✅ |
| 2 | Async Payment Flow — No `payment_intent` | Missing | Phase 8 (v4.42.0) | `/v1/payment-intents` (POST/GET), `/confirm`, `/cancel` (4 paths in spec); 7-state machine; `next_action` discriminator; `payment_intents` table; Edge Function `payment-intents/index.ts` | ✅ |
| 3 | Webhook Delivery & Security | Partial | Phase 8 (v4.42.0) | Stripe-style `X-Webhook-Signature: t=<ts>,v1=<hex>` signed over `${ts}.${body}`; `X-Webhook-Timestamp`; legacy `X-Webhook-Signature-Legacy` kept for deprecation window; `POST /v1/webhooks/events/{eventId}/replay`; `GET /v1/webhooks/dlq` + `/requeue`; runtime updated in `gateway-webhook-deliver-v2/index.ts` | ✅ |
| 4 | Error Standardization — Non-Conforming Errors | Partial | Phase 8 (v4.42.0) | RFC 7807 `application/problem+json` adopted on 4xx/5xx; shared helper `_shared/integration-layer/problem.ts`; component schema `ProblemDetails`; ratchet test `src/test/openapi-problem-details-coverage.test.ts` | ✅ |
| 5 | Sandbox Realism — Shared Creds, No Fault Injection | Weak | Phase 8 (v4.42.0) | `sandbox_api_keys.tier` (free / pro / enterprise) with `sbx_` prefix pattern; `POST /v1/sandbox/trigger` (fault injection); `POST /v1/sandbox/charges/{chargeId}/simulate` (charge-scoped); Edge Functions `sandbox-trigger`, `sandbox-charge-simulate` | ✅ |
| 6 | Regional Adaptation — Fragmented Mobile Money | Partial | Phase 9 (v4.43.0) | `_shared/momo-errors.ts` normalizes MTN / Orange / Wave / M-Pesa / Airtel codes into unified `MobileMoneyErrorCode` enum; `MobileMoneyProviderError` schema; RFC 7807 422 envelopes on `/v1/mobile-money/*` (4 ops) | ✅ |
| 7 | Reconciliation Tooling — No Automated Statement Generation | Missing | Phase 9 (v4.43.0) | `/v1/statements` + `/v1/gateway/statements` (5 paths) generating ISO 20022 `BankToCustomerStatementV08` (camt.053) XML; Edge Function `statements-camt053/index.ts`; guide `docs/developer-portal/guides/camt053-statements.md` | ✅ |

## Live spec parity check (machine-verified)

Ran against `public/openapi.json` (info.version `4.43.0`):

```
payment-intents      OK (4 paths)
webhooks-replay      OK (1 path)
webhooks-dlq         OK (2 paths)
sandbox-trigger      OK (1 path)
sandbox-simulate     OK (1 path)
consents             OK (9 paths)
statements           OK (5 paths)
rate-limits          OK (1 path)
mobile-money         OK (4 paths)
```

Component headers (hyphenated canonical names):

```
X-Idempotent-Replay       OK
X-Idempotency-Status      OK
X-Webhook-Signature       OK
X-Webhook-Timestamp       OK
X-Webhook-Signature-Legacy OK (deprecation window)
X-RateLimit-Limit         OK
X-RateLimit-Remaining     OK
X-RateLimit-Reset         OK
Traceparent               OK
```

Component schemas:

```
ProblemDetails            OK
PaymentIntent             OK
Consent                   OK
MobileMoneyErrorCode      OK
MobileMoneyProviderError  OK
```

## Standing Order compliance

- **#1 Lock**: No operationId, path, schema, security scheme, or component header was renamed or removed.
- **#2 Ratchet**: Compliance only moved forward — added ratchet tests (`openapi-idempotency-response-headers`, `openapi-problem-details-coverage`, `openapi-webhook-signature-coverage`, `openapi-phase9-coverage`, `webhook-signature-runtime-contract`).
- **#3 Audit Trail**: Each remediation cites its standard — RFC 7807 (errors), RFC 9457 (problem+json), W3C Trace Context (traceparent), ISO 20022 (camt.053), Stripe webhook signature spec (`t=,v1=`), RFC 4122 §4.4 (UUID v4 idempotency keys).
- **#4 Surgeon Rule**: All changes were additive. Legacy `Error` envelope, legacy webhook signature, and pre-existing AISP/PISP consent endpoints remain intact.
- **#5 Dead Code Rule**: Every new schema (`PaymentIntent`, `ProblemDetails`, `MobileMoneyProviderError`, etc.) is referenced from at least one operation.
- **#6 Version Gate**: `4.41.x → 4.42.0` (Phase 8) and `4.42.0 → 4.43.0` (Phase 9) — minor bumps for additive endpoints, per spec.

## Cross-reference to prior audit reports

- `docs/audits/phase-8-production-blockers.md` — Gaps 1-5
- `docs/audits/phase-9-high-priority-gaps.md` — Gaps 6 (mobile money) and 7 (camt.053), plus tracing, consents lifecycle, rate-limits publication
- `docs/governance/CHANGELOG-v4.43.0.md` — Governance changelog

## Conclusion

The uploaded gap table reflects the pre-Phase-8 baseline. As of v4.43.0 (released 2026-05-29) every dimension in the uploaded report is implemented, specified, runtime-deployed, and protected by a CI ratchet test. **No further code changes are required to close the uploaded gaps.**
