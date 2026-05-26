# Consumer App ↔ Kang Open Banking API — E2E Banking Audit

**Date:** 2026-05-26
**Scope:** Consumer PWA (`/app/*`) integration with KOB Open Banking edge functions, with emphasis on bank linking, Pay-by-Bank, wallet funding from bank, and wallet → bank withdrawal.
**Auditor:** Lovable

---

## 1. Summary

| Domain | Status | Severity |
|---|---|---|
| Manual bank/RIB linking (no AISP) | Partial | Medium |
| **AISP — connect bank via Open Banking from consumer app** | **Missing** | **High** |
| **PISP — fund wallet from bank (Pay-by-Bank as a debtor)** | **Missing** | **High** |
| Pay-by-Bank merchant intent (`pay-by-bank.create_intent`) | Implemented | — |
| **`pay-by-bank.authorize` actually moves money** | **Broken — fake-completes** | **Critical** |
| Cash-out wallet → bank via KOB rail | Implemented (`gateway-process-withdrawal` + `bank-payout-router`) | — |
| Cash-out wallet → bank via Flutterwave fallback | Implemented | — |
| Fund wallet via bank_transfer (manual instructions) | Implemented | — |
| Bank list (KOB partners + Flutterwave) | Implemented (`CustomerFundWallet`) | — |
| Consumer view of real bank balances (AISP) | Missing | Medium |
| Bank webhook → consumer notifications | Partial | Low |

---

## 2. What the consumer app does today

### 2.1 Linked accounts (`/app/linked-accounts`, `CustomerLinkedAccounts.tsx`)
- 6 types supported: Bank RIB, Bank IBAN, MTN MoMo, Orange Money, PayPal, Card.
- All collection is **manual data entry**: name + RIB/IBAN/phone/email/card number.
- MOD-97 RIB checksum is validated client-side. Bank list comes from `CM_BANKS` constant.
- Stored in `customer_linked_accounts` with `metadata.identifier_type = DOMESTIC_RIB|IBAN`.
- No SCA, no bank-side authentication, no real-time balance pull — the row is purely a beneficiary record.

### 2.2 Bank view (`/app/bank`, `CustomerBank.tsx`)
- Lists `accounts` rows from the `accounts` table (these are KANG internal wallet accounts, not external banks).
- Shows `account_balances` rows and recent `transactions`.
- The "Total Balance" displayed is the user's **KANG wallet balance**, not an aggregated external bank balance.
- There is **no AISP-driven external-bank balance fetch**.

### 2.3 Fund wallet (`/app/fund`, `CustomerFundWallet.tsx`)
Calls `gateway-create-funding-intent` and routes by `provider_type` of the selected linked account:
- `mobile_money` → Flutterwave charge (USSD/STK push)
- `card` → Stripe PaymentIntent
- `paypal` → PayPal Checkout order
- `bank_transfer` → Manual bank-instruction next-action (`type: bank_transfer_instructions`) — user must transfer from their bank manually, reference is `KOBFUND-XXXX`, credited after admin verification (~24–48h) or instantly if `bank_source === 'kob'`.

**Gap:** no PISP-initiated debit from the user's bank. The "instant if KOB partner" branch never actually initiates the debit — it still relies on the user pushing a transfer manually.

### 2.4 Cash out (`/app/cash-out`, `CustomerCashOut.tsx`)
Calls `gateway-process-withdrawal` with `preferred_rail` ∈ {`auto`, `kob_open_banking`, `flutterwave`}. Server:
1. Atomic debit of wallet via `atomic_consumer_withdrawal_debit`.
2. `selectBankPayoutRail()` chooses KOB connector when `banks` + `bank_connector_configs` register one, otherwise Flutterwave.
3. KOB connector adapters (`file-bank`, `rest-bank`, `sql-bank`) execute the transfer.
4. On failure → atomic reverse + Flutterwave fallback.
**This direction (wallet → bank) is working E2E** including idempotency, velocity caps, compliance pre-screen, dispute path, and notification emails.

### 2.5 Pay-by-Bank (`/app/authorize-payment/:intentId`, `PayByBankApproval.tsx`)
Merchant-initiated: merchant calls `pay-by-bank` with `action: create_intent`. The consumer sees an approve/reject screen. On approve, `pay-by-bank.authorize` runs.

**Critical correctness bug:** the `authorize` action in `supabase/functions/pay-by-bank/index.ts`:
- Updates the `pisp_consents` row to `Authorised`.
- Creates a `payments` row with `status = AcceptedSettlementInProcess`.
- Immediately flips intent → `submitted` → `processing` → **`completed`**.
- Sets `payments.status = AcceptedSettlementCompleted`.
- Fires `pay_by_bank.completed` webhook.
- **Never debits the consumer's KANG wallet. Never credits the merchant's wallet.**

The result: a successful "Payment Successful" UI for the consumer, a completed webhook to the merchant, and **no money movement**. This is the root cause of merchants reporting "intent completed but balance unchanged".

---

## 3. KOB Open Banking API surface that already exists but is NOT wired to the consumer app

The following edge functions are production-ready and used by external TPPs / merchants — the consumer PWA does not call any of them:

| Function | Purpose | Consumer-app call sites |
|---|---|---|
| `aisp-create-consent` | Create AISP consent for account info access | **None** |
| `consent-authorize` | Step-up + authorise an AISP/PISP consent | **None** |
| `consent-status` / `consent-revoke` / `consent-extend` | Consent lifecycle | **None** |
| `aisp-accounts`, `aisp-balances`, `aisp-transactions`, `aisp-beneficiaries`, `aisp-standing-orders`, `aisp-direct-debits` | Pull real bank data | **None** |
| `pisp-create-consent` | Create PISP consent for a domestic payment | **None** |
| `pisp-domestic-payment` / `pisp-payment-submission` / `pisp-payment-details` | Initiate, submit, fetch payment | **None** |
| `confirmation-of-payee` | Verify beneficiary name before send | **None** |
| `cbpii-funds-confirmation` | Card-based funds-confirmation | **None** |
| `bank-directory` / `directory-banks-cm` | Bank registry with connector status | Only `CustomerFundWallet` reads `institutions`, not `banks` |
| `facilitated-bank-transfer` | Bank-to-bank facilitated transfer | **None** |

Everything required for a complete consumer Open Banking flow is already deployed on the server side; the consumer PWA simply never invokes it.

---

## 4. Gaps and remediation plan

### 4.1 [CRITICAL] Pay-by-Bank.authorize does not move money — **fixed in this PR**

**Change:** `supabase/functions/pay-by-bank/index.ts` `authorize` action now:
1. Resolves the consumer's primary KANG wallet account.
2. Calls `atomic_debit_balance(_account_id, _amount, _currency)` (raises on insufficient funds).
3. Calls `update_merchant_wallet(_merchant_id, _currency, +amount, +amount)`.
4. On step 3 failure, atomically reverses the debit via `atomic_credit_balance`.
5. Inserts two `transactions` rows (debit + credit) for audit.
6. Only after the transfer succeeds does it flip intent → `completed` and fire `pay_by_bank.completed`.
7. Insufficient-funds returns HTTP 422 with `error: 'insufficient_funds'` so the consumer UI can show a real error instead of "Payment Successful".

This makes the existing consumer Approve flow actually move XAF from the consumer wallet to the merchant wallet, end to end.

### 4.2 [HIGH] AISP — Connect bank via Open Banking (consumer entry point)

**Recommended next step (not in this PR):**
- Add an "**Connect via Open Banking**" CTA in `CustomerLinkedAccounts` dialog beside the manual RIB form.
- Flow: user picks a bank from `banks` where `status='active'` and an active connector exists in `bank_connector_configs` → consumer-app calls `aisp-create-consent` with KANG's own first-party `client_id` (registered as an internal TPP) → redirects to `consent-authorize` page → on success creates a `customer_linked_accounts` row with `metadata.aisp_consent_id` and `metadata.linkage = 'open_banking'`.
- `CustomerBank` then calls `aisp-accounts` + `aisp-balances` to display the real bank balance.

This is ~250 LoC frontend + 1 new edge function (`consumer-aisp-link`) — significant enough that it should be a separate scoped task.

### 4.3 [HIGH] PISP — Fund wallet from bank (true Pay-by-Bank)

**Recommended next step (not in this PR):**
- In `CustomerFundWallet` `bank_transfer` branch, when the chosen bank has `bank_source === 'kob'` and a registered connector, call a new `pisp-fund-wallet` edge function which:
  1. Creates a PISP consent (debtor = user's external bank account, creditor = KANG omnibus + memo of user's wallet).
  2. Returns an `authorization_url` for SCA on the bank's hosted page (or in-app if connector supports embedded SCA).
  3. On successful payment confirmation (webhook), credits the user's KANG wallet via `atomic_credit_balance`.
- Reuses `bank-payout-router` in reverse (`selectBankFundingRail`).

### 4.4 [MEDIUM] Consumer view of real external bank balances

Add a `CustomerExternalBank` panel that, for each linked account with `metadata.linkage === 'open_banking'` and a non-revoked AISP consent, displays `aisp-balances` results next to the KANG wallet. Today `CustomerBank.tsx` only renders internal `accounts` rows.

### 4.5 [MEDIUM] Bank-side data presentation parity

`CustomerBank.tsx` renders external bank metadata (`bankColors` map, Afriland, Ecobank, BICEC, UBA, SCB) but the underlying `accounts` table holds the KANG wallet only — these labels never apply. Either remove the cosmetic bank-name UI when the row is the KANG wallet, or wire it to the linked-account branding from `customer_linked_accounts.provider_name`.

### 4.6 [LOW] Confirmation-of-Payee not used before cash-out

`gateway-process-withdrawal` already supports bank payouts but never calls `confirmation-of-payee` before submitting. Adding a CoP check would reduce mis-direction risk and is a one-line invoke before the rail decision.

### 4.7 [LOW] Pay-by-Bank intent expiry surfacing

`pay-by-bank.get_intent` already auto-expires past `expires_at`, but `PayByBankApproval.tsx` does not show a live countdown to the user. Add a 15-minute countdown chip.

### 4.8 [LOW] `pay-by-bank` consumer auth bounce

If a consumer opens the authorize URL without a session, `PayByBankApproval` redirects to `/app/auth` but does not persist the return path. Apply the same `sessionStorage.setItem('post_login_redirect', ...)` pattern used by `PaymentCheckout.tsx`.

---

## 5. What this PR ships

1. **This audit document.**
2. **Fix #1** — `supabase/functions/pay-by-bank/index.ts` `authorize` action now performs an atomic wallet → merchant transfer (real money movement, insufficient-funds rejection, audit-trail transactions, reversal on credit failure). The auto-complete-without-transfer bug is gone.

Everything in §4.2 – §4.8 is staged for the next iteration. They are additive UI + 1–2 new edge functions and do not block this fix.
