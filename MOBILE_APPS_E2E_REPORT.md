# Mobile Apps E2E Test Suite — Report

**Suite**: `src/test/mobile-apps-payment-e2e.test.tsx`
**Date**: 2026-05-02
**Standing Orders cited**: SO-2 (The Ratchet), SO-7 (Five Roles); P5 (Working Code).

## Coverage

The suite asserts production guarantees across the four mobile/PWA surfaces:
**Banking App**, **Customer App**, **Business App**, **Merchant App**.

| # | Suite | What it locks | Tests |
|---|-------|---------------|-------|
| 1 | Edge function invocation resolution | Every `supabase.functions.invoke('<name>', ...)` call in mobile/hook/component source resolves to a real `supabase/functions/<name>/index.ts`; 21 critical payment functions are present | 23 |
| 2 | Edge function entry-point sanity | Each payment function declares `serve()`/`Deno.serve()`, OPTIONS/CORS preflight, and authenticates via `auth.getUser()` or `resolveAuth()` | 10 |
| 3 | Payment page route resolution | 27 payment pages across the 4 apps exist and default-export a component (catches dynamic-import regressions) | 27 |
| 4 | Financial-safety PIN gating | All inline-mutation pages wire `PinConfirmDialog` or `useSCAChallenge` | 8 |
| 5 | Route prefix presence | `/bank`, `/app` (customer), `/biz`+`/business`, `/m/`+`/merchant` registered; >200 routes total | 5 |
| 6 | Legacy navigation guard | Forbidden legacy paths (e.g., `navigate('/transfer')`) absent from mobile source | 2 |
| **Total** | | | **76** |

## Run Result

```
Tests       74 passed | 2 failed (76)
Test Files  1 failed (1)
```

The 2 failures are **real gaps surfaced by the suite** (not test bugs):

### Gap 1 — `pay-by-bank` edge function lacks authentication
`supabase/functions/pay-by-bank/index.ts` does not call `auth.getUser()` or
`resolveAuth()`. This violates the **Direct Backend Mandate / Financial
Operation Gates** memory rule (state-changing financial mutations must be
authenticated). Recommended fix: add `resolveAuth(req, supabase)` at handler
entry, mirroring `gateway-create-charge`.

### Gap 2 — `BankSendAbroad` (international remittance) lacks PIN gate
`src/pages/banking-app/BankSendAbroad.tsx` calls `sendMutation.mutate()`
directly from the **Send** button without `<PinConfirmDialog>`. International
remittance is a high-risk mutation and the **Step-Up Authentication and MFA
Policy** memory mandates a PIN step. Recommended fix: mirror the
`BankMobileMoney.tsx` pattern (`showPin` state + `executeSend()` callback).

## CI Wiring

The suite runs under the existing Vitest configuration
(`vitest.config.ts` → `include: ["src/**/*.{test,spec}.{ts,tsx}"]`) and is
picked up automatically by `.github/workflows/phase6-e2e.yml` and the
project's default test pipeline. No new CI plumbing is required.

## How to extend

- **New payment edge function**: add the function name to the
  `PAYMENT_FUNCTIONS` array in Suite 2.
- **New payment page**: add `app-folder/PageName` (without `.tsx`) to
  `PAYMENT_PAGES` in Suite 3, and to `PIN_GATED_PAGES` in Suite 4 if it
  performs an inline mutation.
- **Removed legacy path**: append the forbidden navigation string to
  `FORBIDDEN` in Suite 6 to prevent regressions.

## Files

- Created: `src/test/mobile-apps-payment-e2e.test.tsx`
- Created: `MOBILE_APPS_E2E_REPORT.md` (this file)
