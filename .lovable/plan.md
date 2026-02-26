

# Banking App vs V1 API — End-to-End Gap Analysis

## Audit Summary

The Banking PWA has **20 pages** routed under `/bank/:institutionId/*` and the backend has **160+ edge functions**. The audit below maps every app feature to its corresponding API/backend implementation and identifies gaps.

---

## 1. HOME PAGE (`BankHome.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Fetch user name | `supabase.auth.getUser()` | YES | None |
| Total balance display | `aisp-balances` edge function | **NO** — hardcoded `XAF 2,450,000` | **CRITICAL**: Must call `aisp-balances` or query `account_balances` table |
| Multi-currency accounts | `aisp-accounts` edge function | **NO** — hardcoded `mockAccounts` array | **CRITICAL**: Must fetch from `accounts` table |
| Recent transactions | `aisp-transactions` / `api-transactions` | **NO** — hardcoded `mockTransactions` | **CRITICAL**: Must fetch from `transactions` table |
| Savings summary (410K) | `savings-create` / savings tables | **NO** — hardcoded value | **HIGH**: Should query `savings_accounts` for user |
| Loans count (0) | `loan-apply` / loans tables | **NO** — hardcoded value | **HIGH**: Should query `loan_applications` for user |
| Credit score (720) | `credit-score-fetch` | **NO** — hardcoded value | **HIGH**: Should call `credit-score-fetch` |

## 2. PAYMENTS PAGE (`BankPayments.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Quick Send contacts | beneficiaries table | **NO** — hardcoded contacts | **MEDIUM**: Should fetch recent transfer recipients |
| Navigation to sub-pages | Routes defined | YES | None |

## 3. SEND MONEY (`BankSendMoney.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| P2P transfer execution | `api-transfers` edge function | **NO** — uses `setTimeout` fake delay | **CRITICAL**: Must call `api-transfers` to create real transaction |
| Fee calculation | `gateway-fee-estimate` | **NO** — hardcoded `XAF 0` | **HIGH**: Should call fee estimate API |
| Recipient validation | `flutterwave-verify-bank` / account lookup | **NO** | **MEDIUM**: Should validate recipient exists |

## 4. MOBILE MONEY (`BankMobileMoney.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| MoMo/Orange Money transfer | `mobile-money-charge`, `facilitated-mobile-money-charge` | **NO** — uses `setTimeout` fake delay | **CRITICAL**: Must call mobile money edge function |
| Provider selection | Backend supports MTN/Orange | YES (UI only) | Need to pass provider to API |

## 5. QR PAY (`BankQRPay.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Generate QR code | No dedicated edge function | **NO** — placeholder icon only | **HIGH**: Need to generate QR with account/payment data |
| Scan QR code | Camera API | **NO** — button only, no scanner | **HIGH**: Need QR scanner integration |

## 6. PAY BILLS (`BankBills.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Bill payment | `api-bills` edge function exists | **NO** — displays "coming soon" | **MEDIUM**: UI shell exists, needs API wiring |

## 7. RECEIVE MONEY (`BankReceive.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Fetch account ID | `accounts` table query | **YES** | None |
| Copy to clipboard | Browser API | **YES** | None |
| Share functionality | — | **NO** — shows "coming soon" toast | **LOW** |

## 8. CARDS PAGE (`BankCards.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| List virtual cards | `virtual-card-list` | **NO** — hardcoded single card | **CRITICAL**: Must call `virtual-card-list` |
| Create new card | `virtual-card-create` (Cardyfie) | **NO** — button present, no action | **CRITICAL**: Must call `virtual-card-create` |
| Top up card | `virtual-card-topup` | **NO** — button present, no action | **HIGH** |
| Freeze/unfreeze card | `virtual-card-update-status` | **NO** — button present, no action | **HIGH** |
| Card transactions | `virtual-card-transactions` | **NO** — not displayed | **HIGH** |

## 9. HISTORY PAGE (`BankHistory.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Transaction list | `api-transactions` / `aisp-transactions` | **NO** — hardcoded `mockTransactions` | **CRITICAL**: Must fetch real transactions |
| Search/filter | — | YES (client-side on mock data) | Works, but needs real data |
| Export PDF/CSV | `generate-bank-statement` / `data-export` | **NO** — button present, no action | **HIGH**: Edge functions exist, need wiring |

## 10. SAVINGS PAGE (`BankSavings.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| List savings goals | `savings_accounts` table | **NO** — hardcoded goals | **CRITICAL**: Must query savings accounts |
| Create new goal | `savings-create` | **NO** — button present, no action | **CRITICAL** |
| Deposit to savings | `savings-deposit` | **NO** | **HIGH** |
| Withdraw from savings | `savings-withdraw` | **NO** | **HIGH** |
| Interest accrual display | `savings-accrue-interest` | **NO** | **MEDIUM** |

## 11. LOANS PAGE (`BankLoans.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| List active loans | `loan_applications` table | **NO** — hardcoded "No active loans" | **CRITICAL**: Must query user's loans |
| Apply for loan | `loan-apply` | **NO** — button present, no action | **CRITICAL** |
| Loan repayment | `loan-repay` | **NO** | **HIGH** |
| EMI calculator | `loan-calculate` | **NO** | **MEDIUM** |
| Loan products list | `loan_products` table | **NO** — hardcoded products | **HIGH** |

## 12. CREDIT SCORE (`BankCreditScore.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Fetch score | `credit-score-fetch` | **NO** — hardcoded 720 | **CRITICAL** |
| Score factors | `credit-score-calculate` | **NO** — hardcoded factors | **HIGH** |
| Score simulation | `credit-score-simulate` | **NO** | **MEDIUM** |
| Score tips | `credit-score-tips` | **NO** | **LOW** |

## 13. KYC (`BankKYC.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| KYC wizard | `kyc-submit` edge function | **PARTIAL** — component exists via `KYCOnboardingWizard` | Need to verify wizard calls API |

## 14. SETTINGS (`BankSettings.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Personal info edit | `profiles` table | **NO** — static list, no actions | **HIGH** |
| PIN management | `pin-code-set`, `pin-code-verify` | **NO** | **HIGH** |
| Security settings | `password-reset-with-pin` | **NO** | **MEDIUM** |
| Language preference | `user_preferences` table | **NO** — setting exists in DB but not wired | **MEDIUM** |

## 15. NOTIFICATIONS (`BankAlerts.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| List notifications | No dedicated notifications table | **NO** — hardcoded mock alerts | **HIGH**: Need to create or query notification source |

## 16. HELP (`BankHelp.tsx`)

| Feature | Backend Exists? | Wired? | Gap |
|---|---|---|---|
| Contact options | Static UI | YES (display only) | **LOW** |

---

## Priority Summary

### CRITICAL (8 gaps) — App shows fake data where real APIs exist:
1. Home: Balance, accounts, transactions all hardcoded
2. Send Money: No real transfer execution
3. Mobile Money: No real MoMo charge
4. Cards: No virtual card CRUD
5. History: Hardcoded transactions
6. Savings: No real savings data or creation
7. Loans: No real loan data or application
8. Credit Score: Hardcoded score

### HIGH (10 gaps) — Features with buttons but no backend wiring:
- Export (PDF/CSV), Fee estimation, Card top-up/freeze, Savings deposit/withdraw, Loan repayment, Loan products from DB, Score factors from API, Settings actions, PIN management, Notifications

### MEDIUM/LOW (7 gaps) — Nice-to-have or "coming soon":
- QR scanner, Bill payments, Recipient validation, Score simulation, Language, Share, Help

---

## Recommended Implementation Order

**Phase A** — Wire real data to existing pages (no new UI needed):
1. Home: Fetch accounts, balances, transactions from DB
2. History: Fetch transactions with pagination
3. Cards: Fetch virtual cards from `virtual_cards` table
4. Savings: Fetch savings accounts
5. Loans: Fetch loan applications
6. Credit Score: Call `credit-score-fetch`

**Phase B** — Wire actions to backend APIs:
1. Send Money → `api-transfers`
2. Mobile Money → `mobile-money-charge`
3. Cards → `virtual-card-create`, `virtual-card-topup`, `virtual-card-update-status`
4. Savings → `savings-create`, `savings-deposit`, `savings-withdraw`
5. Loans → `loan-apply`, `loan-repay`
6. History Export → `generate-bank-statement`

**Phase C** — Secondary features:
1. Settings → profile edit, PIN set/verify
2. Notifications → real notification source
3. Bill payments → `api-bills`
4. QR code generation and scanning
5. Fee estimation on transfers

