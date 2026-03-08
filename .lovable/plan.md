

# Kang Open Banking V1 API — Go-Live Audit Report

## Scope

Full line-by-line audit of 250+ edge functions, shared utilities, provider adapters, webhook handlers, transfer engine, OAuth/OIDC stack, compliance screening, fee engine, and settlement infrastructure. This audit is structured by severity: **Critical** (blocks go-live), **High** (must fix before production traffic), **Medium** (should fix), and **Low** (hardening/polish).

---

## CRITICAL (Must Fix Before Go-Live)

### C1. Transfer Engine: Non-Atomic Balance Updates (Race Condition)

**File:** `supabase/functions/api-transfers/index.ts` (lines 294-383)

The core P2P/B2B transfer engine performs balance debit and credit as two separate Supabase UPDATE calls. Under concurrent requests, two transfers from the same account can both read the same balance, pass the sufficiency check, and both succeed — causing a **double-spend**. The rollback on credit failure (line 350) is also non-atomic: if the rollback itself fails, funds vanish.

**Fix:** Wrap the entire debit-credit-transaction-insert flow in a single PL/pgSQL function using `SELECT ... FOR UPDATE` row locks and a single transaction block. This is the single most critical issue for a banking API.

### C2. Bulk Transfers: Same Race Condition, No Row Locking

**File:** `supabase/functions/bulk-transfers/index.ts` (lines 148-216)

Identical problem to C1. Additionally, bulk transfers process rows sequentially within a single edge function invocation, meaning a timeout on row 50 of 100 leaves the batch half-processed with no batch-level rollback or continuation mechanism.

**Fix:** Same as C1 — atomic PL/pgSQL function. Add batch status tracking with resume capability.

### C3. Stripe Refund: Ignores Zero-Decimal Currency Conversion

**File:** `supabase/functions/_shared/gateway-adapters.ts` (line 281)

`createStripeRefund` hardcodes `Math.round(req.amount * 100)` for the refund amount. For XAF (a zero-decimal currency already listed in `ZERO_DECIMAL_CURRENCIES`), this multiplies by 100, causing a refund of 100x the intended amount. The charge creation (`createStripeCharge` line 197) correctly uses `toStripeAmount()`, but the refund does not.

**Fix:** Replace line 281 with `params.append('amount', toStripeAmount(req.amount, req.currency || 'XAF').toString());` — requires passing `currency` through the `RefundRequest` interface.

### C4. `RefundRequest` Interface Missing `currency` Field

**File:** `supabase/functions/_shared/gateway-adapters.ts` (lines 42-46)

The `RefundRequest` interface has no `currency` field, making C3 impossible to fix without also updating this interface. Every refund caller must pass currency.

### C5. Flutterwave Webhook: Double Wallet Credit

**File:** `supabase/functions/gateway-webhook-flutterwave/index.ts` (lines 107-117)

When a Flutterwave charge succeeds, the webhook handler calls `atomic_charge_wallet_credit` (line 109). But the `atomic_charge_wallet_credit` PL/pgSQL function also updates the charge status — however the charge status was already updated on line 47-51. This means the wallet gets credited correctly, but if the Stripe webhook handler for the same charge type also ran (e.g., webhook retry), the merchant wallet could be double-credited. More critically: the `fund_account` path on lines 54-105 credits the user's balance AND THEN the code on line 108 also credits the merchant wallet. For `fund_account` charges, the merchant wallet credit is incorrect.

**Fix:** Add a guard: only call `atomic_charge_wallet_credit` when `!charge.metadata?.fund_account`. Or use a `credited_at` timestamp column on `gateway_charges` to prevent double-crediting.

### C6. Stripe Webhook: Signature Verification Is Conditional

**File:** `supabase/functions/gateway-webhook-stripe/index.ts` (lines 24-43)

If `STRIPE_WEBSECRET_KEY` is not set, or if the `stripe-signature` header is missing, the webhook proceeds without verification (line 25: `if (STRIPE_WEBHOOK_SECRET && signature)`). In production, an attacker can send forged webhook events by simply omitting the signature header.

**Fix:** Make signature verification mandatory. Return 401 if either the secret is unconfigured or the signature header is missing.

### C7. Flutterwave Webhook: Weak Signature Verification

**File:** `supabase/functions/gateway-webhook-flutterwave/index.ts` (lines 24-28)

The Flutterwave `verif-hash` check compares a static shared secret. If `FLUTTERWAVE_ENCRYPTION_KEY` is not set, verification is silently skipped (line 26: `if (FLW_HASH && ...)`). Same bypass vulnerability as C6.

---

## HIGH (Must Fix Before Production Traffic)

### H1. No Idempotency on Core Transfers

**File:** `supabase/functions/api-transfers/index.ts`

The transfer endpoint has no idempotency key support. A network retry could create duplicate transfers. Gateway charges and payouts correctly implement idempotency, but the banking transfer engine does not.

### H2. PayPal Payout Failure Reversal: Wrong Balance Type

**File:** `supabase/functions/gateway-webhook-paypal/index.ts` (lines 96-103)

On payout failure, the reversal queries `InterimAvailable` balance only (line 96). The rest of the codebase uses `ClosingAvailable` as the primary balance type. If the account only has a `ClosingAvailable` record, the reversal silently fails and funds are lost.

### H3. Flutterwave Webhook Uses Local CORS Instead of Shared

**File:** `supabase/functions/gateway-webhook-flutterwave/index.ts` (lines 6-9)

Defines its own `corsHeaders` locally instead of importing from `_shared/cors.ts`. This means it's missing the `x-supabase-client-platform` headers that Supabase's infrastructure now requires, which can cause `Failed to fetch` errors on some clients.

### H4. Gateway Payout Uses Local CORS

**File:** `supabase/functions/gateway-create-payout/index.ts` (lines 6-9)

Same issue as H3 — local CORS headers instead of shared import.

### H5. Gateway Pre-Auth Charge Uses Local CORS

**File:** `supabase/functions/gateway-preauth-charge/index.ts` (lines 8-11)

Same local CORS issue.

### H6. Compliance Screen Not Enforced on Standard Payouts

**File:** `supabase/functions/gateway-create-payout/index.ts`

The standard payout endpoint has no compliance screening call. Only `gateway-instant-payout` runs inline compliance. All outbound money movements should be screened.

### H7. mTLS Certificate Detail Extraction Returns Placeholder Data

**File:** `supabase/functions/_shared/mtls.ts` (lines 186-203)

`extractCertificateDetails()` returns hardcoded placeholder values (`CN=Extracted from PEM`, serial `00`). Any code relying on this for certificate validation would accept any certificate as valid.

### H8. Access Token Stored as Plaintext

**File:** `supabase/functions/oauth-token/index.ts` (lines 194, 260, 322)

Access tokens are stored as `token_hash` but the value is the actual plaintext token (from `generateSecureToken()`), not a hash. The column name is misleading and if the `access_tokens` table is compromised, all tokens are exposed. The token should be SHA-256 hashed before storage, with only the hash stored.

### H9. Rate Limiter Fails Open

**File:** `supabase/functions/_shared/security.ts` (line 78)

`checkRateLimit` returns `true` (allow) on database errors. For a banking API, this should fail closed to prevent abuse during outages.

---

## MEDIUM (Should Fix)

### M1. Transfer Ledger Entry Is Incorrect

**File:** `supabase/functions/api-transfers/index.ts` (lines 483-486)

The double-entry journal posts debit to Cash (1000) and credit to Deposits (2000). For an internal transfer between two customer accounts, both sides are deposits — the correct entry should debit one deposits sub-account and credit another, or post no entry at all for internal movements.

### M2. Bulk Transfer CSV Parser: No Escaping or Quoting Support

**File:** `supabase/functions/bulk-transfers/index.ts` (lines 317-336)

The CSV parser splits on commas with no support for quoted fields. Account names containing commas will corrupt the parse. Use a proper CSV parsing library.

### M3. PISP Domestic Payment Hardcodes XAF Only

**File:** `supabase/functions/pisp-domestic-payment/index.ts` (line 73)

Rejects any currency other than XAF. The Open Banking specification should support multi-currency (at minimum EUR and USD for diaspora transfers).

### M4. PayPal Uses Production Endpoint Only

**File:** `supabase/functions/_shared/gateway-adapters.ts` (line 310)

`getPayPalAccessToken()` hardcodes `api-m.paypal.com` (production). There's no sandbox toggle. Testing requires live PayPal credentials.

### M5. Error Responses Inconsistent Across Functions

Some functions return RFC 7807 `application/problem+json` (compliance-screen, instant-payout), while most return plain `application/json` with ad-hoc error structures. The public-facing API should standardize on RFC 7807.

### M6. No Request Body Size Limit

None of the edge functions validate request body size. A malicious actor could send multi-MB payloads to exhaust memory.

### M7. `record_transaction_fee` RPC vs Utility Mismatch

**File:** `supabase/functions/api-transfers/index.ts` (line 499)

Calls `supabase.rpc('record_transaction_fee', ...)` but the shared utility in `_shared/record-transaction-fee.ts` uses direct table inserts. If the RPC doesn't exist (it's not in the DB functions list), this silently fails.

### M8. Missing Audit Trail on Certain Gateway Operations

`gateway-create-payout` logs an audit entry, but `gateway-create-refund` does not. Refunds should be fully audited.

---

## LOW (Hardening)

### L1. `supabase-js` Version Pinning Inconsistency

Edge functions import varying versions: `@supabase/supabase-js@2`, `@2.39.3`, `@2.7.1`, `@2.49.4`. Pin all to a single version to prevent subtle API differences.

### L2. `Deno.serve` vs `serve()` Inconsistency

Some functions use the legacy `serve(async (req) => ...)` pattern from `std@0.168.0`, others use the modern `Deno.serve(async (req) => ...)`. Both work but should be standardized.

### L3. PayPal Payout Balance Lookup Missing `credit_debit_indicator` Filter

**File:** `supabase/functions/gateway-webhook-paypal/index.ts` (line 96)

The `InterimAvailable` lookup doesn't filter by `credit_debit_indicator`, unlike all other balance queries in the codebase.

### L4. Console Logging of Sensitive Data

**File:** `supabase/functions/_shared/gateway-adapters.ts` (line 169)

Logs up to 500 chars of the Flutterwave response, which may include card tokens or PII.

### L5. Missing `Cache-Control: no-store` on Token Responses

**File:** `supabase/functions/oauth-token/index.ts`

OAuth 2.0 spec requires `Cache-Control: no-store` and `Pragma: no-cache` on token responses. Currently missing.

---

## Summary Priority Matrix

| Priority | Count | Action |
|----------|-------|--------|
| **CRITICAL** | 7 | Must fix before any live transactions |
| **HIGH** | 9 | Must fix before opening to banks/merchants |
| **MEDIUM** | 8 | Fix before public developer onboarding |
| **LOW** | 5 | Fix during hardening phase |

## Recommended Go-Live Sequence

1. **Immediate (Week 1):** Fix C1-C7 — atomic transfers, Stripe currency bug, webhook signature enforcement, double-credit guard
2. **Week 2:** Fix H1-H9 — idempotency on transfers, CORS standardization, compliance enforcement on all payouts, token hashing
3. **Week 3:** Fix M1-M8 — error standardization, CSV parser, audit trail gaps
4. **Week 4:** Fix L1-L5 — version pinning, logging hygiene, cache headers

