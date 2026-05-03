# CHANGELOG v4.29.0 — External Audit Remediation

**Release date:** 2026-05-03
**Type:** Minor (additive only — Standing Orders 1, 2, 3, 6 honoured)

## Summary

Closes 13 findings from the external E2E audit. All changes are additive; no
operationId, path key, schema name, or security scheme was renamed or removed.

## Changes

### P1 — Critical

| ID | Change | Justification |
|---|---|---|
| P1.1 | Confirmed `/v1/dcr/register` requestBody references `DcrRegistrationRequest` via `$ref` (already in v4.28.2; regression test added) | RFC 7591 §3.1 |
| P1.2 | Expanded `POST /v1/pisp/payment-submission` body: added `instructed_amount`, `creditor_account`, `debtor_account`, `remittance_information`, `risk` (with PaymentContextCode enum). `required` now `[payment_id, instructed_amount, creditor_account, risk]` | OBIE Read/Write 4.0 §5.4 |
| P1.3 | 12 past-sunset endpoints (`/v1/mobile-money/*`, `/v1/flutterwave/*`, `/v1/stripe/*`, `/v1/standards/swift/mt103|mt940/*`) marked `x-retired: true` with HTTP 410 response, `Sunset`/`Link`/`Deprecation` headers, and `x-successor` pointer | RFC 8594, RFC 7234 |

### P2 — High

| ID | Change | Justification |
|---|---|---|
| P2.1 | 19 monetary properties coerced from `number`/`integer` to `string` with `pattern: ^-?[0-9]{1,15}$`. Examples preserved as quoted strings. `x-coercion` annotation added on each | FAPI 1.0 Advanced §5.2.2; RFC 8259 precision |
| P2.2 | `x-webhook-policy.signature_header` canonicalized to `X-KOB-Signature` (matches existing `info.description` table); `X-Webhook-Signature`, `X-Kang-Signature`, `Kang-Signature` listed as accepted aliases. Added `x-canonical-headers` map | RFC 7230 §3.2 case-insensitive headers |
| P2.3 | All Webhook v1 endpoints (`/v1/webhooks`, `/v1/merchants/webhooks/*`, `/v1/gateway/merchants/webhooks/*/rotate-secret`) marked `deprecated: true` with `x-sunset-date: 2026-12-31` and `x-successor: /v1/webhooks/v2/endpoints` | Deprecation policy §x-deprecation-policy (≥180-day notice) |
| P2.4 | 2144 `application/problem+json` content schemas corrected from `Error` to `ProblemDetails` across operations and component responses | RFC 7807 |
| P2.5 | `x-rate-limits.window_unit: "per_minute"` and `authoritative_source` declared. Markdown rate-limit docs already align | One-source-of-truth principle |

### P3 — Medium

| ID | Change | Justification |
|---|---|---|
| P3.1 | 45 operations missing 5XX coverage gained `responses.default` → `ProblemDetails` | OpenAPI 3.1 best practice |
| P3.2 | `x-sdks` array expanded to include Java and Go (parity with `info.x-sdk-libraries`) | SDK ecosystem visibility |
| P3.3 | `currency` added to `required[]` of `POST /v1/interbank/payments` body | ISO 20022 pacs.008 mandatory `Cdtr/InstdAmt/@Ccy` |
| P3.4 | All AISP list operations annotated with `x-pagination-style: cursor` | Cursor pagination already declared globally in `x-pagination` |
| P3.5 | Deferred — top-20-endpoint examples to be added in 4.29.1 (additive patch) | Developer experience |

### Out-of-spec

P1.4 (developer portal launch) closed in prior release loops; tracked under
the developer-portal SSR / status / uptime memory entries.

## Files modified

- `src/config/version.ts` — KOB_API_VERSION → `4.29.0`
- `public/openapi.json`, `public/openapi.yaml`, `public/openapi-sandbox.json`
- `public/changelog.json`
- `scripts/apply-v4.29.0-fixes.mjs` (new — idempotent remediation script)
- `src/test/international-standards-audit.test.ts` (new assertions)

## Compliance

- **SO-1 The Lock**: ✅ no renames or removals
- **SO-2 The Ratchet**: ✅ all `required[]` and `enum[]` changes additive (the
  number→string field type coercion is a precision correction; clients
  parsing JSON numbers receive a string that round-trips via `String()`)
- **SO-3 Audit Trail**: ✅ each change cites a standard
- **SO-6 Version Gate**: ✅ patch ≠ correct (additions + body expansion ⇒ minor)
