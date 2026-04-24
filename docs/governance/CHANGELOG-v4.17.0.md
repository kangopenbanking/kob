# Kang Open Banking API — v4.17.0

**Release date:** 2026-04-24
**Type:** Minor (additive, non-breaking)
**Standing Orders satisfied:** SO-1 (The Lock), SO-2 (The Ratchet), SO-3 (Audit Trail), SO-4 (Surgeon Rule), SO-6 (Version Gate), SO-7 (Five Roles)

## Summary

Spec correctness pass addressing the three real findings of the 2026-04-24 Developer API audit. All changes are additive — no `operationId`, path, schema, parameter, or security scheme has been renamed or removed.

## Changes

### 1. Monetary type correctness — `VirtualCard`

**Justification:** RFC 8259 §6 (number representation is implementation-defined → unsafe for currency) and FAPI 1.0 Advanced §5.2.2 (monetary values must be lossless).

| Field | Before | After |
|---|---|---|
| `balance_usd` | `number` | `number`, `deprecated: true` (kept for backward compatibility — SO-1) |
| `balance` *(new)* | — | `string`, `pattern: ^[0-9]{1,15}$` — minor-unit integer |
| `currency` *(new)* | — | `string`, ISO 4217 enum `[USD, XAF, EUR, GBP]` |

### 2. Monetary type correctness — `LoanScheduleItem`

| Field | Before | After |
|---|---|---|
| `principal`, `interest`, `fees`, `total_due` | `number` | `number`, `deprecated: true` |
| `principal_amount`, `interest_amount`, `fees_amount`, `total_due_amount` *(new)* | — | `string`, minor-unit integers |
| `outstanding_balance` | `number` (edge fn) / `string` (public file) | `string` everywhere — synchronised |

### 3. Reusable error responses (FAPI / RFC 7807)

Added to `components.responses`:

- **`Unauthorized`** — RFC 6750 §3.1. Returns `application/problem+json` (`ProblemDetails`) and includes a `WWW-Authenticate` header example.
- **`Forbidden`** — Insufficient scope or non-owned resource. Returns `application/problem+json`.

These are now available for `$ref` from any operation. Existing inline 401/403 declarations remain valid.

### 4. OBIE schema split — `TransactionOBIE`

**Justification:** OBIE Read/Write Data API v3.1 §Transaction. SDK generators (OpenAPI Generator, openapi-typescript, etc.) emit duplicate fields when snake_case and PascalCase coexist on one schema.

- New `TransactionOBIE` schema in `components.schemas` containing all PascalCase OBIE fields with `x-obie-version: 3.1.10`.
- The original PascalCase aliases on the primary `Transaction` schema are now `deprecated: true` with `x-replacement: "TransactionOBIE.<Field>"`.
- Original snake_case fields on `Transaction` (e.g. `transaction_id`, `amount`) are unchanged.

## Compatibility

| Consumer | Impact |
|---|---|
| Existing clients reading `balance_usd`, `principal`, etc. | None. Fields still present and populated. |
| New clients | Should read the string-typed siblings (`balance` + `currency`, `*_amount`). |
| OBIE-aligned consumers | Switch from `Transaction` to `TransactionOBIE`. |
| SDK generators | Re-generation will produce both old and new fields; mark deprecated ones for removal in v5.0.0. |

## Files changed

- `public/openapi.json`
- `supabase/functions/public-api-spec/index.ts`
- `docs/governance/CHANGELOG-v4.17.0.md` *(this file)*
