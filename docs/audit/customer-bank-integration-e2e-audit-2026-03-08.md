# Customer ↔ Bank Integration — End-to-End Audit Report
**Date:** 2026-03-08  
**Scope:** Customer wallet funding (bank→wallet) and withdrawal (wallet→bank) flows  
**Files Audited:** 6 edge functions, 4 frontend pages, 3 shared utilities

---

## Executive Summary

Comprehensive audit of all financial flows between the Customer App and the banking system. **5 gaps identified and fixed**, including 1 **CRITICAL** double-debit vulnerability. All flows are now production-ready.

---

## Flow 1: Fund Wallet (Bank → Wallet)

### Frontend: `CustomerFundWallet.tsx`
| Check | Status | Notes |
|-------|--------|-------|
| Linked account source selection | ✅ PASS | Sources from `customer_linked_accounts`, respects `is_active` |
| Provider auto-derivation | ✅ PASS | `providerTypeToMethod()` maps account type → payment method |
| Bank selection (bank_transfer) | ✅ PASS | Dual-source: KOB institutions + Flutterwave banks |
| Fee estimation (real-time) | ✅ PASS | Uses `useFeeEstimate` hook, institution-scoped |
| Amount validation | ✅ PASS | Positive check, conditional phone/email fields |
| PIN confirmation gate | ✅ **FIXED** | Was missing — now uses `PinConfirmDialog` before `handleSubmit` |
| Redirect return cache refresh | ✅ **FIXED** | Added `useSearchParams` listener to invalidate caches on return |
| FundingResult next_action handling | ✅ PASS | Handles redirect, stripe_confirm, mobile_money_confirm, bank_transfer_instructions |
| Cache invalidation on success | ✅ PASS | Invalidates 5 query keys |

### Backend: `gateway-create-funding-intent`
| Check | Status | Notes |
|-------|--------|-------|
| Multi-scope auth (end_user/merchant/institution/external_api) | ✅ PASS | Full OAuth + JWT support |
| Account ownership verification | ✅ PASS | Per-scope validation |
| Idempotency check | ✅ PASS | Via `funding_intents` table |
| Fee calculation (institution-aware) | ✅ PASS | Uses `calculateGatewayFee` with merchant/institution fallback |
| Daily/monthly limit enforcement | ✅ PASS | Via `sumUsageForPeriod` |
| Provider routing (Flutterwave/Stripe/PayPal/Bank) | ✅ PASS | All 4 providers wired |
| Funding intent persistence | ✅ PASS | Records `funding_intents` + `funding_events` |
| Transaction fee recording | ✅ PASS | Via `recordTransactionFee` for billing |
| Bank transfer instructions (KOB vs external) | ✅ PASS | Differentiates instant vs 24-48h |

---

## Flow 2: Cash Out / Withdraw (Wallet → Bank)

### Frontend: `CustomerCashOut.tsx`
| Check | Status | Notes |
|-------|--------|-------|
| Linked account destination selection | ✅ PASS | Filtered by admin-enabled methods |
| Wallet balance display | ✅ PASS | From `useAccountBalances` |
| Fee calculation (local mirror) | ✅ PASS | Reads `fee_structures` table, supports fixed/percentage/hybrid |
| Amount validation + limits | ✅ PASS | Min/max/daily limits from admin config |
| Insufficient balance check | ✅ PASS | `isOverBalance` flag |
| PIN confirmation gate | ✅ PASS | `PinConfirmDialog` at confirm step |
| Processing time display | ✅ PASS | Per-destination-type estimates |
| In-app notification | ✅ PASS | Inserts `app_notifications` with tx metadata |
| Email confirmation | ✅ PASS | Non-blocking `send-communication` call |
| Cache invalidation | ✅ PASS | 4 query keys invalidated |

### Backend: `gateway-process-withdrawal`
| Check | Status | Notes |
|-------|--------|-------|
| Auth check | ✅ PASS | JWT extraction + `auth.getUser()` |
| Account ownership + is_active | ✅ **FIXED** | Added `.eq('is_active', true)` filter |
| Balance lookup (Credit indicator) | ✅ PASS | Correctly filters `credit_debit_indicator = 'Credit'` |
| Balance record null safety | ✅ **FIXED** | Changed `.single()` → `.maybeSingle()` with graceful error |
| Fee from fee_structures | ✅ PASS | Reads platform-level withdrawal fee |
| Idempotency check | ✅ **FIXED (CRITICAL)** | Added full idempotency-key support to prevent double-debit |
| Idempotency storage | ✅ **FIXED** | Stores response in `idempotency_keys` table |
| Debit-with-rollback pattern | ✅ PASS | Atomic UPDATE, reversed on provider failure |
| Provider routing | ✅ PASS | Stripe (card refund), Flutterwave (bank + MoMo), PayPal (batch) |
| Failed transaction recording | ✅ PASS | Records failed tx + audit log on provider error |
| Successful transaction recording | ✅ PASS | Records in `transactions` + `gateway_payouts` + `audit_logs` |
| CORS headers | ✅ PASS | Uses shared `_shared/cors.ts` |

---

## Flow 3: Legacy Fund Account (gateway-fund-account)

| Check | Status | Notes |
|-------|--------|-------|
| Auth check | ✅ PASS | JWT-based |
| Account ownership | ✅ PASS | `user_id` + `is_active` |
| Idempotency | ✅ PASS | Via `idempotency_keys` table |
| Fee calculation | ✅ PASS | `calculateGatewayFee` |
| Provider routing | ✅ PASS | Flutterwave + Stripe |
| Balance credit (immediate) | ✅ PASS | Upserts `ClosingAvailable` balance |
| Audit trail | ✅ PASS | Records in `audit_logs` |

## Flow 4: Legacy Withdraw to Bank (gateway-withdraw-to-bank)

| Check | Status | Notes |
|-------|--------|-------|
| Auth check | ✅ PASS | JWT-based |
| Balance check (Credit filter) | ✅ PASS | Correctly uses `credit_debit_indicator = 'Credit'` |
| Balance UPDATE (not INSERT) | ✅ PASS | Fixed in prior audit — atomic UPDATE pattern |
| Debit reversal on failure | ✅ PASS | Restores original balance |
| CORS | ✅ PASS | Shared `_shared/cors.ts` |

---

## Fixes Applied

### 🔴 CRITICAL: Idempotency in gateway-process-withdrawal
**Risk:** Network retries could trigger duplicate wallet debits, causing fund loss.  
**Fix:** Added full idempotency-key check on request entry and storage on successful response via `idempotency_keys` table.

### 🟡 HIGH: Balance record null crash
**Risk:** `.single()` throws if no balance record exists, returning 500 instead of a helpful error.  
**Fix:** Changed to `.maybeSingle()` with explicit null check returning `no_balance_record` error.

### 🟡 HIGH: Missing is_active filter on account lookup
**Risk:** Deactivated accounts could still receive withdrawal requests.  
**Fix:** Added `.eq('is_active', true)` to account ownership query.

### 🟡 HIGH: No PIN gate on CustomerFundWallet
**Risk:** Funding operations bypassed the mandatory PIN security gate required by platform standards.  
**Fix:** Added `PinConfirmDialog` — user must verify 6-digit PIN before payment is initiated.

### 🟢 MEDIUM: No cache refresh on redirect return
**Risk:** After Flutterwave/PayPal redirect, balances appear stale.  
**Fix:** Added `useSearchParams` listener that invalidates balance/transaction caches when URL contains status params.

---

## Verified Integration Points

| Integration | Direction | Provider | Status |
|-------------|-----------|----------|--------|
| Mobile Money (MTN/Orange) | Fund Wallet | Flutterwave | ✅ |
| Mobile Money (MTN/Orange) | Cash Out | Flutterwave MoMo Payout | ✅ |
| Card (Visa/MC) | Fund Wallet | Stripe PaymentIntent | ✅ |
| Card (Visa/MC) | Cash Out | Stripe Refund | ✅ |
| PayPal | Fund Wallet | PayPal Orders API | ✅ |
| PayPal | Cash Out | PayPal Payouts API | ✅ |
| Bank Transfer | Fund Wallet | KOB Instant / Flutterwave | ✅ |
| Bank Transfer | Cash Out | Flutterwave Bank Payout | ✅ |

---

## Conclusion

All customer ↔ bank financial transaction flows are **production-ready** with proper security (PIN gates, idempotency, atomic balance operations, debit-with-rollback), complete audit trails, and multi-provider support.
