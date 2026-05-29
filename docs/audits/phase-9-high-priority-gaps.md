# Phase 9 — High-Priority Gaps (#6-#9 + rate-limit publication)

**Version bump:** `4.42.0 → 4.43.0` (minor; additive only).

## Gap → Resolution matrix

| # | Gap | Resolution |
|---|---|---|
| 6 | Mobile-money error code normalization | New `MobileMoneyErrorCode` enum + `MobileMoneyProviderError` schema + shared `_shared/momo-errors.ts` mapper. RFC 7807 `422` examples wired to every `/v1/mobile-money/*` POST. Reference: `docs/developer-portal/reference/mobile-money-errors.md`. |
| 7 | Consent object lifecycle endpoints | New `/v1/consents` rail-agnostic façade (`POST`, `GET`, `GET /{id}`, `DELETE /{id}`, `POST /{id}/extend`). Edge function `consents-lifecycle/` routes to existing AISP/PISP functions. Existing rail-specific endpoints untouched. Reference: `docs/developer-portal/guides/consents-lifecycle.md`. |
| 8 | OpenTelemetry tracing header propagation | New `Traceparent` + `Tracestate` request parameters added to every operation. Echoed via response header on every 2xx. Shared helper `_shared/tracing.ts` extracts, propagates and forwards to upstream `fetch()`. Reference: `docs/developer-portal/reference/tracing.md`. |
| 9 | camt.053 statement generation | New `/v1/statements` + `/v1/statements/{id}` + `/v1/statements/{id}/content` endpoints. Edge function `statements-camt053/` emits ISO 20022 BankToCustomerStatementV08 XML. Reference: `docs/developer-portal/guides/camt053-statements.md`. |
| ★ | Per-tier rate limit publication | New `/v1/rate-limits` read endpoint + `RateLimitTier` / `RateLimitTiers` schemas + `rate-limits-info/` edge function. Reference: `docs/developer-portal/reference/rate-limits.md`. |

## Standing Orders compliance

- **#1 LOCK**: zero renames, zero removals.
- **#2 RATCHET**: every new schema, header, parameter and operation is additive.
- **#3 AUDIT**: cited W3C Trace Context Level 2, Berlin Group NextGenPSD2 v1.3.6, ISO 20022 camt.053.001.08, GSMA Mobile Money API v1.2, RFC 6585.
- **#4 SURGEON**: all changes additive.
- **#5 DEAD CODE**: every new component (`Traceparent`, `Tracestate`, `MobileMoneyErrorCode`, `MobileMoneyProviderError`, `ConsentCreate`, `ConsentList`, `StatementRequest`, `Statement`, `RateLimitTier`, `RateLimitTiers`) is referenced by at least one operation.
- **#6 VERSION**: minor bump `4.42.0 → 4.43.0`.

## Files

- `scripts/phase9-spec-hardening.mjs` — sole spec mutator.
- `supabase/functions/_shared/momo-errors.ts`, `_shared/tracing.ts` — runtime helpers.
- `supabase/functions/consents-lifecycle/index.ts`, `statements-camt053/index.ts`, `rate-limits-info/index.ts` — new edge functions.
- `docs/developer-portal/reference/{mobile-money-errors,tracing,rate-limits}.md`.
- `docs/developer-portal/guides/{consents-lifecycle,camt053-statements}.md`.
- `src/test/openapi-phase9-coverage.test.ts` — ratchet guard.
- Specs: `public/openapi.json` + `.yaml`, `public/openapi-sandbox.json` + `.yaml`.
- `src/config/version.ts`, `public/changelog.json` — version sync.

## Out of scope

- Removal of any legacy endpoint or response field.
- Non-additive spec changes.
- Differentiator gaps (offline SDK, CEMAC instant routing, AI fraud, DID KYC).
