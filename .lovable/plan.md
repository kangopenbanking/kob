# Nium Global Accounts — Compliance & Transparency Hardening

## Phase 1 — Audit Findings

Already in place (no rebuild needed):
- Edge functions: `nium-create-global-account`, `nium-list-global-accounts`, `nium-update-payout-preference`, `nium-webhook`.
- DB: `nium_global_accounts`, `nium_incoming_payments` with FX, spread, fee, routing columns; `profiles.payout_preference` + `payout_channel` (cascade default).
- Webhook computes Nium FX rate + `nium_fx_spread` (bps) + `nium_withdrawal` fee, credits XAF, triggers Flutterwave MoMo when routed.
- Legacy `/v1/gateway/virtual-accounts` (Wema/NGN) is untouched.
- SDKs (node/python/php) + `docs/developer-portal/payments/global-accounts.md` already shipped against OpenAPI v4.50.0.

Gaps vs. directive:
1. No hardcoded BEAC PoP constants; `beneficiary_name` accepts free-text override in create endpoint.
2. No KYC-name enforcement — should be pulled from verified `profiles.full_name` / `kyc_verifications`, free-text rejected.
3. Webhook returns net XAF in payload but the UI has no pre-cashout "Transaction Preview" (gross → Nium FX → KOB spread → MoMo fee → net XAF) endpoint or modal.
4. Legacy endpoint is live but not marked `deprecated: true` with `sunset` in `public/openapi.json`.
5. Frontend onboarding does not capture `default_payout_method`; account create UI lacks the non-dismissible exact-name warning.
6. CHANGELOG + developer guide need a v4.50.1 entry covering PoP lock, KYC name lock, FX preview, legacy deprecation.

## Phase 2 — Implementation Plan

### 2.1 Constants (additive, no breaking change)
- New file `src/constants/nium-compliance.ts`:
  - `NIUM_POP_CODES = { SOFTWARE_DIGITAL_SERVICES: "Software/Digital Services", ROYALTIES: "Royalties" } as const`
  - `NiumPopCode` union type, `ALLOWED_NIUM_POP_CODES` array, helper `assertAllowedPopCode()`.
- Mirror in edge runtime: `supabase/functions/_shared/nium-compliance.ts` (Deno-safe copy) imported by `nium-create-global-account` and `nium-webhook`.

### 2.2 Database (additive only — Standing Order 4)
Single migration:
- `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_payout_method text` with CHECK in (`KANG_WALLET`,`MOBILE_MONEY`) and backfill from existing `payout_preference`. Keep `payout_preference` for backward compat (no rename — Standing Order 1).
- `ALTER TABLE public.nium_global_accounts ADD COLUMN IF NOT EXISTS pop_code text NOT NULL DEFAULT 'Software/Digital Services'` with CHECK in the two allowed values.
- `ALTER TABLE public.nium_incoming_payments ADD COLUMN IF NOT EXISTS pop_code text`.
- No new public tables → no new GRANT block required.

### 2.3 Edge functions
- `nium-create-global-account/index.ts`:
  - Reject any `beneficiary_name` in the request body (return 400 `beneficiary_name_override_forbidden`). // COMPLIANCE CHECK: strict name matching.
  - Resolve beneficiary from `profiles.full_name` (fallback `kyc_verifications.full_name` where `status='approved'`); 409 if KYC not approved.
  - Accept optional `pop_code` (default `Software/Digital Services`); validate against `ALLOWED_NIUM_POP_CODES`. // COMPLIANCE CHECK: BEAC PoP.
  - Persist `pop_code`; forward to Nium adapter call.
- `nium-webhook/index.ts`:
  - Carry account's `pop_code` onto each `nium_incoming_payments` row.
  - No behaviour change to FX math (already correct); add `xaf_net_credited` and `fx_rate_effective` to the webhook response payload that the preview endpoint will reuse.
- New function `nium-quote-payout` (GET): given `{ source_amount, source_currency, route?: KANG_WALLET|MOBILE_MONEY, msisdn? }`, returns `{ fx_rate_nium, spread_bps, xaf_gross, xaf_spread_revenue, xaf_withdrawal_fee, xaf_net_credited, expires_at }`. Shares FX/fee helpers with the webhook (extract into `_shared/nium-fx.ts`).

### 2.4 Frontend (`src/pages/customer-app/GlobalReceivingAccount.tsx` + onboarding)
- Generate-account flow: remove the (currently hidden) name input; show read-only `Beneficiary: {profile.full_name}` plus a persistent `Alert` banner (non-dismissible) — copy: *"Your YouTube/TikTok/Adsense profile must match this exact name or the payment will be rejected."*
- Add `PopCodeSelect` (two options only). Default `Software/Digital Services`.
- New `TransactionPreview` modal triggered before any cash-out: calls `nium-quote-payout`, renders gross → Nium FX → KOB spread → MoMo fee → **Net XAF** with disclosure tooltip; Confirm button disabled until preview loads.
- Onboarding (search for existing payout-preference step under `src/pages/customer-app/onboarding*` / `OnboardingPayoutPreference`): add `default_payout_method` selector wired to `nium-update-payout-preference` with `scope: 'user'`.

### 2.5 OpenAPI / docs (Standing Orders 1, 2, 6, 7; P7, P10)
- `public/openapi.json` + `.yaml`:
  - Add `deprecated: true` and `x-sunset: 2027-01-01` on all `/v1/gateway/virtual-accounts*` operations. Leave operationIds untouched.
  - Add `pop_code` enum + `default_payout_method` to relevant schemas; add new `/v1/gateway/global-accounts/quote` operation.
  - Bump `info.version` to **4.50.1**; mirror in `src/config/version.ts` (`KOB_API_VERSION`, `KOB_POSTMAN_VERSION`, `KOB_SPEC_DATE`) and `public/changelog.json`.
- `docs/developer-portal/payments/global-accounts.md`: add PoP-code section, exact-name notice, `/quote` example in cURL/Node/Python (Order P9).
- `public/sdk-downloads/CHANGELOG-{node,python,php}.md` + root `CHANGELOG.md`: v4.50.1 entry — BEAC PoP lock, KYC name lock, FX preview, legacy VA deprecated. Cite **BEAC Règlement 02/18/CEMAC/UMAC/CM** in audit trail comment (Standing Order 3).

### 2.6 Tests
- Vitest: reject free-text `beneficiary_name`; reject unknown PoP; quote endpoint math parity with webhook.
- Playwright (`e2e/authenticated/global-accounts.spec.ts` already exists): add preview-modal flow and exact-name warning visibility.

## Technical Notes
- No renames, no removals (Standing Orders 1 & 4). All schema/spec changes are additive; legacy NGN endpoints keep working.
- Patch bump 4.50.0 → 4.50.1 (Standing Order 6 — additive + deprecation flag only).
- Shared FX helper extracted so quote and webhook can never drift.
- RLS unchanged (no new tables).

## Files Touched
- New: `src/constants/nium-compliance.ts`, `supabase/functions/_shared/nium-compliance.ts`, `supabase/functions/_shared/nium-fx.ts`, `supabase/functions/nium-quote-payout/index.ts`, `src/components/global-accounts/TransactionPreview.tsx`, `src/components/global-accounts/PopCodeSelect.tsx`.
- Edited: `supabase/functions/nium-create-global-account/index.ts`, `supabase/functions/nium-webhook/index.ts`, `src/pages/customer-app/GlobalReceivingAccount.tsx`, onboarding payout step, `public/openapi.{json,yaml}`, `public/changelog.json`, `src/config/version.ts`, `docs/developer-portal/payments/global-accounts.md`, `CHANGELOG.md`, SDK changelogs, vitest + Playwright specs.
- Migration: single additive ALTER for `profiles`, `nium_global_accounts`, `nium_incoming_payments`.
