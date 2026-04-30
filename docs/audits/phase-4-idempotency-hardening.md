# Phase 4 — Idempotency Hardening

**Date**: 2026-04-30
**OpenAPI version**: 4.19.0 → **4.20.0** (patch, additive only)
**Scope**: Document `Idempotency-Key` header on every financial mutating operation.

## Justification

| Standard | Clause | Mandate |
|---|---|---|
| Stripe API Reference | "Idempotent Requests" | All POST endpoints accept an idempotency key |
| PSD2 RTS | Article 36(1)(b) | Deterministic retry semantics for payment initiation |
| Project Core Memory | "Idempotency" | UUID v4 `idempotency_key` mandatory for atomic financial transactions |
| Standing Order #4 | Surgeon Rule | All changes additive — `required: false` to preserve back-compat |
| Standing Order #2 | The Ratchet | Once declared, the parameter cannot be removed without a major version bump |

## What changed

### Spec (additive only)
Inlined an `Idempotency-Key` header parameter (`required: false`, `format: uuid`) on **18 financial mutating operations** that were previously undeclared. The shared `#/components/parameters/IdempotencyKey` was not used because that variant is `required: true` and would constitute a breaking change for existing clients.

### Endpoints patched (18)

| Method | Path | Tag |
|---|---|---|
| POST  | /v1/flutterwave/verify-bank | Payments |
| POST  | /v1/gateway/verify-bank-account | Payment Gateway |
| POST  | /v1/gateway/resolve-bvn | Payment Gateway |
| POST  | /v1/gateway/risk/score | Payment Gateway |
| PUT   | /v1/gateway/payment-plans/{planId} | Payment Gateway |
| PATCH | /v1/gateway/subscriptions/{subscriptionId} | Payment Gateway |
| POST  | /v1/gateway/subscriptions/cancel | Payment Gateway |
| PUT   | /v1/gateway/subaccounts/{subaccountId} | Payment Gateway |
| PUT   | /v1/gateway/customers/{customerId} | Payment Gateway |
| POST  | /v1/consumer/njangi/join | Consumer Tools |
| POST  | /v1/accounts/{accountId}/overdraft/recalculate | Overdraft |
| POST  | /v1/accounts/{accountId}/overdraft/suspend | Overdraft |
| POST  | /v1/accounts/{accountId}/overdraft/revoke | Overdraft |
| POST  | /v1/reconciliation/mismatches/{mismatchId}/resolve | Payment Gateway |
| POST  | /v1/pay-by-bank/intents | Pay by Bank |
| POST  | /v1/pay-by-bank/intents/{intentId}/authorize | Pay by Bank |
| POST  | /v1/pay-by-bank/intents/{intentId}/reject | Pay by Bank |
| POST  | /v1/pay-by-bank/callback | Pay by Bank |

### CI Ratchet
New test: `src/test/openapi-idempotency-coverage.test.ts`
- Asserts **zero** financial POST/PUT/PATCH operations are missing `Idempotency-Key`.
- Asserts every declared `Idempotency-Key` uses `string` + `uuid` (or pattern) schema.

## What did NOT change

- Runtime helper `supabase/functions/_shared/integration-layer/idempotency.ts` — already correct (lookup → conflict → store cycle, composite uniqueness on `merchant_id,idempotency_key`).
- Existing 143 mutating operations that already declared `Idempotency-Key` — untouched.
- The `required: true` shared component `#/components/parameters/IdempotencyKey` — preserved verbatim for new endpoints that want to mandate it.
- Non-financial mutations (auth/OTP, ISO20022/SWIFT parsers, captcha, RIB/IBAN validators, KYC sanctions screen) — intentionally excluded; no money side-effect.

## Verification

- Pre-patch audit: 18 financial ops missing `Idempotency-Key`.
- Post-patch audit: 0.
- JSON↔YAML parity preserved (both bumped to 4.20.0).
- Phase 1.5 ratchet tests (2xx schema, operationId uniqueness, security declared) remain green.
