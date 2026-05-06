# KYB End-to-End Audit — 2026-05-06

Scope: `gateway-merchant-kyb-review` + `MerchantKYB.tsx` + admin `BusinessKYCReview.tsx`.

## Lifecycle (verified)

| Step | Actor | Path | Status |
|---|---|---|---|
| Submit KYB | Merchant | POST `gateway-merchant-kyb-review` action=`submit` | PASS |
| Start review | Admin | POST action=`start_review` (submitted → under_review) | PASS |
| Approve | Admin | POST action=`review` decision=`approve` | PASS — now blocked if coverage incomplete |
| Reject | Admin | POST action=`review` decision=`reject` (reason required) | PASS |
| Suspend / Reinstate | Admin | POST action=`suspend` \| `reinstate` | PASS |
| Status read | Owner / Admin | GET `?merchant_id=` | PASS — now returns `coverage`, `required_document_types`, `required_metadata_fields` |

## Coverage gates added (enforced before approval)

- Required document types: `business_registration`, `tax_certificate`, `proof_of_address`
- Required metadata fields: `kyb_business_registration`, `kyb_tax_id`, `kyb_business_address`
- Approval attempts that fail coverage now return HTTP **422** `kyb_coverage_incomplete` with `missing_documents` and `missing_fields` arrays — surfaced to the admin UI by `extractEdgeFunctionError`.

## Structured logging

All paths now emit single-line JSON logs with `ts`, `level`, `fn`, `event`, plus contextual fields (`merchant_id`, `decision`, `db_error`, `error_id`). The unhandled-exception branch logs the message, name, and the first 5 stack frames, and includes `error_id` in the response so support can join logs to user reports.

## Error contract

`rfc7807` responses now include both `detail` (RFC 7807) and `error` / `message` (Supabase client convention) plus optional structured `extra` (e.g. `missing_documents`). Frontend `extractEdgeFunctionError` continues to surface the real cause.

## Regression tests

`supabase/functions/gateway-merchant-kyb-review/index.test.ts` — 5 tests, all green:
- coverage: missing documents
- coverage: missing metadata fields
- coverage: full pass
- state machine: legal transitions
- decision validation: reject requires reason

Run: `deno test --allow-net --allow-env --allow-read supabase/functions/gateway-merchant-kyb-review/index.test.ts`

## Gaps closed in this pass

1. Approvals could previously succeed against merchants with missing documents/metadata → now blocked with structured 422.
2. Edge function returned generic `internal_error` on exceptions → now returns the real message + `error_id`.
3. No automated regression coverage for the lifecycle → 5 Deno tests added.
4. GET response did not surface what was still required for approval → now returns `coverage`.

## Remaining (non-blocking) follow-ups

- Document storage MIME validation lives in `kyc-storage.ts`; consider mirroring into `gateway-merchant-kyb-review` submit path for symmetry with `business-kyc-submit`.
- Add Playwright authenticated spec under `e2e/authenticated/kyb-approval.spec.ts` once seed users land (tracked in `e2e/SEEDING.md`).
