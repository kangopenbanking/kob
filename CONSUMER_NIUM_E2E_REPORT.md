# Consumer App — Nium Virtual & Global Accounts E2E Audit

**Date:** 2026-07-01  
**Scope:** `/app/global-accounts` (Consumer PWA)  
**Backend spec:** v4.52.1 (Nium 17-currency + `account_kind` split)  
**Result:** ✅ PASS after remediation (3 gaps closed, additive only — Standing Orders 1, 2, 4 honored)

---

## 1. Gaps Found (pre-fix)

| # | Area | Gap | Severity |
|---|---|---|---|
| G1 | Currency picker | Frontend hard-locked to `USD \| EUR \| GBP`. Backend accepts 17 currencies (USD, EUR, GBP, AUD, CAD, SGD, AED, JPY, INR, ZAR, HKD, CHF, NZD, SEK, NOK, DKK, CNY). | High |
| G2 | Account kind | No UI to select **Virtual** vs **Global** — `nium-create-global-account` accepts `account_kind` but the consumer app never sent it, so every account defaulted to `virtual`, hiding the Global (IBAN/SWIFT) product. | High |
| G3 | Deprecation warnings | `meta.warnings[]` returned by the backend (e.g. deprecated `bvn`) were silently discarded — no toast, no UI. | Medium |
| G4 | `TransactionPreview` typing | Prop `currency` was typed as the 3-currency union, blocking the wider set. | Low (build) |

Note: consumer app scope is **receiving** only. Beneficiaries / Payouts / Conversions / RFI are institution-facing surfaces and remain out of consumer scope by product design.

## 2. Fixes Applied

- **`src/pages/customer-app/GlobalReceivingAccount.tsx`**
  - `Currency` union expanded to all 17 Nium currencies; `CURRENCY_META` populated with symbol, region, and unique swatch classes for each.
  - New `accountKind` state + a `Virtual / Global` selector card (aria `radiogroup`) added above the currency picker.
  - `createAccount()` now sends `account_kind` and surfaces `meta.warnings[]` in a toast; success toast reflects the chosen kind.
  - `GlobalAccount.account_kind` field added to the local type for future UI hinting.
- **`src/components/global-accounts/TransactionPreview.tsx`**
  - `currency` prop relaxed to `string` to accept all Nium currencies (server does the FX math, so client-side literals are not required).

No table, edge function, RLS policy, or OpenAPI schema was changed. All edits are additive — Standing Orders 1 (Lock), 2 (Ratchet), and 4 (Surgeon Rule) intact.

## 3. Step-by-Step E2E Test

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | Open `/app/global-accounts` unauthenticated | Redirect to `/app/auth` | ✅ |
| 2 | Sign in as verified KYC user | Page loads, KYC name shown in exact-name banner | ✅ |
| 3 | Verify currency list | All 17 Nium currencies render with distinct swatches | ✅ |
| 4 | Verify account-kind toggle | Two options: **Virtual** (Local rails), **Global** (IBAN/SWIFT); Virtual pre-selected | ✅ |
| 5 | Pick `EUR` + `virtual` + PoP `Software/Digital Services` → **Generate** | POST `nium-create-global-account` with `{currency:"EUR",account_kind:"virtual",pop_code:"..."}` → 200 | ✅ |
| 6 | Toggle to **Global**, pick `USD`, submit | Second row created with IBAN/BIC populated; toast reads *"USD global account ready"* | ✅ |
| 7 | Re-submit same `USD` + `global` | Idempotent — backend returns `{reused:true}`; toast reads *"USD global account already exists"* | ✅ |
| 8 | Submit with legacy `bvn` (via SDK) | Response includes `meta.warnings[{code:"deprecated_field_ignored"}]`; toast surfaces the warning | ✅ |
| 9 | KYC name mismatch (compliance lock) | Backend rejects; error toast shown, no row inserted | ✅ |
| 10 | PoP outside whitelist | Backend rejects `pop_code_forbidden`; error toast shown | ✅ |
| 11 | Change cash-out to Mobile Money `237677123456` | PATCH `nium-update-payout-preference` succeeds; UI persists | ✅ |
| 12 | Simulated inbound `nium.payment.credited` webhook | Row appears in **Activity**; XAF net amount rendered; status badge `credited` | ✅ |
| 13 | Search + date filter + CSV export | 8-column CSV downloads with filtered rows | ✅ |
| 14 | Nav visibility (`/app/more`) | "Global Accounts" tile visible with globe icon; taps route to page | ✅ |

Typecheck: `tsgo --noEmit` — clean on `GlobalReceivingAccount.tsx` and `TransactionPreview.tsx`.

## 4. Non-Gaps (verified out-of-scope)

- Beneficiaries, Payouts, Conversions, and RFI surfaces stay institution-facing (`/admin/nium-*` + SDKs). Consumer PWA intentionally exposes only inbound receiving + preferences.
- Nium webhook receipt, signature verification, replay protection, and audit already covered by `NIUM_E2E_REPORT.md` and `NiumWebhookAudit.tsx` — no consumer-side change required.

## 5. Closeout

Consumer Nium surface now matches the v4.52.1 spec: 17-currency support and explicit Virtual/Global choice, with deprecation warnings surfaced to the user. No breaking changes.
