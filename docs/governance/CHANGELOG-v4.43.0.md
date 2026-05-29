# CHANGELOG v4.43.0 — 2026-05-29

**Type:** minor · **Breaking changes:** none

## Summary

Phase 9 — high-priority gaps #6–#9 plus per-tier rate-limit publication. Every change is additive; zero renames, zero removals (Standing Orders #1, #2, #4).

## Highlights

- **Consents lifecycle façade** — new `/v1/consents` (`POST`/`GET`/`GET /{id}`/`DELETE /{id}`/`POST /{id}/extend`). Routes to existing AISP/PISP functions. Reference: [`docs/developer-portal/guides/consents-lifecycle.md`](../developer-portal/guides/consents-lifecycle.md).
- **ISO 20022 camt.053 statements** — new `/v1/statements`, `/v1/statements/{id}`, `/v1/statements/{id}/content`. Edge function `statements-camt053/` emits BankToCustomerStatementV08 XML. Reference: [`docs/developer-portal/guides/camt053-statements.md`](../developer-portal/guides/camt053-statements.md).
- **Per-tier rate limits** — new `/v1/rate-limits` read endpoint and `RateLimitTier` / `RateLimitTiers` schemas. Reference: [`docs/developer-portal/reference/rate-limits.md`](../developer-portal/reference/rate-limits.md).
- **Mobile-money error normalization** — new `MobileMoneyErrorCode` enum and `MobileMoneyProviderError` schema. RFC 7807 `422` envelope wired onto every `/v1/mobile-money/*` POST. Shared helper `_shared/momo-errors.ts` maps MTN/Orange/Wave/M-Pesa/Airtel codes to a single taxonomy. Reference: [`docs/developer-portal/reference/mobile-money-errors.md`](../developer-portal/reference/mobile-money-errors.md).
- **W3C Trace Context** — `traceparent` + `tracestate` accepted on every operation, echoed on every 2xx, propagated to every upstream `fetch()` via `_shared/tracing.ts`. Reference: [`docs/developer-portal/reference/tracing.md`](../developer-portal/reference/tracing.md).

## Standing Orders compliance

- **#1 LOCK**: zero renames, zero removals.
- **#2 RATCHET**: every new schema, header, parameter, and operation is additive.
- **#3 AUDIT**: W3C Trace Context Level 2, Berlin Group NextGenPSD2 v1.3.6, ISO 20022 camt.053.001.08, GSMA Mobile Money API v1.2, RFC 6585.
- **#4 SURGEON**: additive only.
- **#5 DEAD CODE**: every new component (`Traceparent`, `Tracestate`, `MobileMoneyErrorCode`, `MobileMoneyProviderError`, `ConsentCreate`, `ConsentList`, `StatementRequest`, `Statement`, `RateLimitTier`, `RateLimitTiers`) is referenced by ≥1 operation.
- **#6 VERSION**: minor bump `4.42.0 → 4.43.0`.

## Files

- Spec: `public/openapi.json` + `.yaml`, `public/openapi-sandbox.json` + `.yaml`, snapshot at `public/openapi-history/openapi-4.43.0.json`.
- Script: `scripts/phase9-spec-hardening.mjs`.
- Edge functions: `consents-lifecycle/`, `statements-camt053/`, `rate-limits-info/`.
- Helpers: `supabase/functions/_shared/momo-errors.ts`, `_shared/tracing.ts`.
- Ratchet: `src/test/openapi-phase9-coverage.test.ts`.
- Audit: `docs/audits/phase-9-high-priority-gaps.md`.
