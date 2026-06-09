# KYC/KYB End-to-End Audit — 2026-06-09

(See chat for full report; key blockers below.)

## Critical (HIGH) blockers
1. `unified-kyc-gateway` never writes `youverify_session_id` back to `kyc_verifications` → Youverify webhook → status pipeline is dead.
2. `src/pages/merchant/MerchantKYB.tsx` submits `documents: []` → `validateKybDocuments` rejects every merchant KYB submission.
3. No step-up MFA on admin approve/reject (`admin-kyc-review`, `admin-kyb-verify`, `admin-institution-approve`).
4. No webhook ingestion E2E test for Youverify.
5. `business-kyc-submit` has no Zod validation.

## Medium
- `kyc-submit` & `business-kyc-submit` perform no server-side MIME/size check on document URLs (only `gateway-merchant-kyb-review` does).
- `business_kyc` lacks `one-active-per-user` unique index → TOCTOU race.
- No `info_requested` action for KYB (institution or merchant).
- `admin-kyb-verify` allows only `admin` role (KYC allows compliance_officer/moderator).
- `kyc_gateway_idempotency` rows never purged (no pg_cron).
- `unified-kyc-gateway` GET status missing `coverage` / `required_document_types` / `required_metadata_fields`.
- `BusinessKYCReview.tsx` fetches all `business_kyc` rows without institution scoping.
- `kyb-submission-and-approval.spec.ts` oversized-file test is a no-op `expect(true).toBe(true)` stub.

## Low
- All admin functions return status 400 even on 5xx server faults.
- `validate_kyc_submission` trigger fires only on INSERT, not UPDATE.
- `admin-institution-approve` hardcodes dashboard URL.
- `admin-kyc-review` reuses `rejection_reason` column for `info_request_message`.

## Provider in use
Youverify (HMAC webhook + circuit breaker + feature flags in `unified-kyc-gateway`). Self-hosted fallback via `kyc-submit` works; Youverify automated path is broken because session_id is never persisted.
