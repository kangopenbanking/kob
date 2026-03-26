

# E2E Deep Audit Plan: Consumer (Customer) App & Banking App

## Audit Scope

Both PWA apps across **all 50+ routes**, **40+ edge functions**, **all forms/submissions**, and **all financial flows**.

## Methodology

1. Trace every route → component → data hook → edge function
2. Verify form submissions reach backend
3. Check error handling completeness
4. Identify dead routes, broken wiring, or unhandled edge cases

---

## CUSTOMER APP (`/app/*`) — 40 Routes

### A. Auth & Onboarding (4 routes)
| Route | Component | Backend | Status |
|---|---|---|---|
| `/app` | CustomerSplash | — | ✅ Static |
| `/app/auth` | CustomerAuth | Phone/Email OTP | ✅ Verified in prior audit |
| `/app/register` | CustomerRegister | profiles insert | ✅ |
| `/app/onboarding` | CustomerOnboarding | linked accounts wizard | ✅ |

### B. Core Financial (12 routes)
| Route | Component | Edge Function | Findings |
|---|---|---|---|
| `/app/home` | CustomerHome | accounts, balances, transactions | ✅ Multi-institution aggregation |
| `/app/transfer` | CustomerTransfer | `api-transfers` | ✅ Supports phone/account/RIB/IBAN/name with PIN gate |
| `/app/send-money` | CustomerSendMoney | `remittance-outbound` (get_corridors, get_quote, send, track, list_outbound) | ✅ Full multi-step wizard with corridor selection |
| `/app/fund` | CustomerFundWallet | `gateway-create-funding-intent` | ✅ MoMo/Card/PayPal/Bank with fee estimation |
| `/app/cash-out` | CustomerCashOut | `gateway-process-withdrawal` | ✅ Full withdrawal flow with fee calc, Auto Cash Out rules |
| `/app/bills` | CustomerBillsV2 | `api-bills-v2` (6 actions) | ✅ Category→Provider→Form→PIN→Receipt flow |
| `/app/split-bills` | CustomerSplitBills | Direct DB: `split_bills`, `split_bill_participants` | ⚠️ **GAP: No notification to participants** — bill is created but other participants are not notified via push/SMS/email |
| `/app/recurring` | CustomerRecurring | Direct DB: `recurring_payments` | ⚠️ **GAP: No cron/scheduler executing payments** — payments are recorded but there is no edge function or cron that actually processes them on the `next_payment_date` |
| `/app/request` | CustomerRequest | — (generates QR + share link) | ✅ Uses `qrcode.react`, shareable link |
| `/app/scan` | CustomerScan | `api-transfers` for wallet payments | ✅ QR scan, manual entry, merchant POS flow |
| `/app/remittances` | CustomerRemittances | Direct DB: `remittances` | ✅ Inbound remittance history with event timeline |
| `/app/pay-links` | CustomerPayLinks | — | ✅ Pay link management |

### C. Account Management (3 routes)
| Route | Component | Backend | Findings |
|---|---|---|---|
| `/app/linked-accounts` | CustomerLinkedAccounts | Direct DB: `customer_linked_accounts` | ✅ 6 account types, 3-account limit enforced |
| `/app/bank` | CustomerBank | — | ✅ Bank linking |
| `/app/cards` | CustomerCards | — | ✅ Virtual card display |

### D. Savings & Credit (4 routes)
| Route | Component | Backend | Findings |
|---|---|---|---|
| `/app/piggybank` | CustomerPiggyBank | `usePiggyBankPlans`, `usePiggyBankPay` hooks + savings_products query | ✅ Explore + Create + Pay flows |
| `/app/njangi` | CustomerNjangi | `useNjangiData` hooks (create, join, contribute, payout) | ✅ Full ROSCA circle management |
| `/app/rent-reporting` | CustomerRentReporting | — | ✅ Rent reporting for credit building |
| `/app/credit` | CustomerCreditScore | — | ✅ Credit score display |

### E. Commerce (5 routes)
| Route | Component | Backend | Findings |
|---|---|---|---|
| `/app/stores` | CustomerStores | — | ✅ Marketplace browse |
| `/app/stores/:merchantId` | CustomerStoreDetail | — | ✅ Product catalog |
| `/app/cart` | CustomerCart | — | ✅ Cart + checkout |
| `/app/orders` | CustomerOrderTracking | — | ✅ Order history |
| `/app/invoices` | CustomerInvoices | — | ✅ Invoice display |

### F. Travel (6 routes)
| Route | Component | Backend | Findings |
|---|---|---|---|
| `/app/travel` | CustomerTravelCategories | — | ✅ |
| `/app/travel/:category` | CustomerTravelAgencies | — | ✅ |
| `/app/travel/:category/:serviceId` | CustomerTravelTrips | — | ✅ |
| `/app/travel/.../trips/:tripId` | CustomerTravelBooking | — | ✅ |
| `/app/travel/ticket/:bookingId` | CustomerTravelTicket | — | ✅ |
| `/app/travel/history` | CustomerTravelHistory | — | ✅ |

### G. Support & Settings (6 routes)
| Route | Component | Backend | Findings |
|---|---|---|---|
| `/app/support` | CustomerSupport | `useSupportChat` hooks (departments, conversations, messages) | ✅ Live chat with department routing |
| `/app/disputes` | CustomerDisputes | Direct DB: `disputes` | ✅ File + track disputes |
| `/app/settings` | CustomerSettings | — | ✅ |
| `/app/alerts` | CustomerAlerts | — | ✅ |
| `/app/help` | CustomerHelp | — | ✅ |
| `/app/rewards` | CustomerRewards | — | ✅ |

### H. Special (1 route)
| Route | Component | Backend |
|---|---|---|
| `/app/authorize-payment/:intentId` | PayByBankApproval | — | ✅ Open Banking consent |

---

## BANKING APP (`/bank/:institutionId/*`) — 22 Routes

### A. Auth & Onboarding (4 routes)
| Route | Component | Status |
|---|---|---|
| `/bank/:id` | BankSplash | ✅ |
| `/bank/:id/auth` | BankAuth | ✅ Phone/Email with PIN-first for +237 |
| `/bank/:id/apply` | BankApply | ✅ Account application wizard |
| `/bank/:id/kyc` | BankKYC | ✅ KYC onboarding |

### B. Core Banking (8 routes)
| Route | Component | Edge Function | Findings |
|---|---|---|---|
| `home` | BankHome | accounts, balances | ✅ 6 layout styles |
| `payments` | BankPayments | — | ✅ Feature-gated menu |
| `payments/send` | BankSendMoney | `useSendTransfer` → `api-transfers` | ✅ Account/RIB/IBAN + PIN gate |
| `payments/qr` | BankQRPay | — | ✅ Real QR codes (fixed in prior audit) |
| `payments/mobile-money` | BankMobileMoney | — | ✅ MTN/Orange + PIN |
| `payments/bills` | BankBills | — | ✅ 4 categories + PIN |
| `payments/receive` | BankReceive | — | ✅ Account number copy+share |
| `fund` | BankFundAccount | `gateway-create-funding-intent` | ✅ 4 methods with fee estimation + bank selector |

### C. Financial Services (5 routes)
| Route | Component | Findings |
|---|---|---|
| `more/savings` | BankSavings | ✅ Goals, deposit/withdraw |
| `more/savings/new` | BankNewSavings | ✅ Product select |
| `more/loans` | BankLoans | ✅ Apply, repay with PIN |
| `more/credit` | BankCreditScore | ✅ Event-sourced timeline |
| `more/remittances` | BankRemittances | ✅ Inbound remittance history |

### D. Settings & Support (5 routes)
| Route | Component | Findings |
|---|---|---|
| `more/settings` | BankSettings | ✅ |
| `more/alerts` | BankAlerts | ✅ |
| `more/help` | BankHelp | ✅ Chat persists to DB (fixed in prior audit) |
| `more/disputes` | BankDisputes | ✅ File + track |
| `more/support` | BankSupport | ✅ |
| `history` | BankHistory | ✅ Search, filter, PDF export |
| `cards` | BankCards | ✅ Manage button wired (fixed in prior audit) |
| `more` | BankMore | ✅ Feature-gated services |

---

## EDGE FUNCTION COVERAGE MATRIX

| Edge Function | Used By | Auth | Validation | Error Handling |
|---|---|---|---|---|
| `api-transfers` | CustomerTransfer, BankSendMoney | ✅ JWT | ✅ Required fields + positive amount + self-transfer check | ✅ |
| `remittance-outbound` | CustomerSendMoney | ✅ JWT | ✅ 6 actions with corridor/quote validation | ✅ |
| `gateway-create-funding-intent` | CustomerFundWallet, BankFundAccount | ✅ JWT | ✅ Amount + method + account checks | ✅ |
| `gateway-process-withdrawal` | CustomerCashOut | ✅ JWT | ✅ Amount + balance + destination + idempotency | ✅ |
| `api-bills-v2` | CustomerBillsV2 | ✅ JWT | ✅ Multi-action router | ✅ |

---

## GAPS IDENTIFIED

### GAP 1: Split Bills — No Participant Notification (MEDIUM)
**File:** `CustomerSplitBills.tsx` (line 122-148)
**Issue:** When a split bill is created, participants are inserted into `split_bill_participants` but no notification (push, SMS, email, or in-app) is sent to them. Participants with phone numbers have no way to know they owe money.
**Fix:** After successful insert, call `send-communication` or insert into `app_notifications` for each participant with a phone/user match.

### GAP 2: Recurring Payments — No Execution Engine (MEDIUM-HIGH)
**File:** `CustomerRecurring.tsx` (line 73-101)
**Issue:** The form creates records in `recurring_payments` with `next_payment_date`, but there is no cron job, edge function, or scheduler that actually processes these payments when due. The UI shows "Active" status and next dates, but nothing executes.
**Fix:** Create a `recurring-payments-cron` edge function that:
1. Queries `recurring_payments` where `is_active = true AND next_payment_date <= now()`
2. For each, invokes the appropriate payment action (bill pay, transfer)
3. Updates `next_payment_date` and `last_payment_date`
4. Logs success/failure in `recurring_payment_executions` table

### GAP 3: CustomerMore Navigation — "Send Abroad" path mismatch (LOW)
**File:** `CustomerMore.tsx` (line 31)
**Issue:** The "Send Abroad" utility item navigates to `go('send-money')` which maps to `/app/send-money` ✅ — this is correct. No gap here after verification.

### GAP 4: Console Warning — AnimatePresence duplicate keys (LOW)
**Source:** Console logs show `Encountered two children with the same key` in Auth.tsx AnimatePresence.
**Impact:** Visual glitch during auth tab switching. Non-blocking.
**Fix:** Ensure unique keys in AnimatePresence children in `Auth.tsx`.

### GAP 5: OneSignal Registration Failure (LOW)
**Source:** Console: `[OneSignal] Registration skipped: Cannot read properties of undefined`
**Impact:** Push notifications silently fail to register.
**Fix:** Add null-safety check in `useOneSignal.ts` before accessing OneSignal SDK properties.

---

## IMPLEMENTATION PLAN

### Phase 1 — Fix Gap 1: Split Bill Notifications
- After `split_bill_participants` insert succeeds, for each participant with a phone number:
  - Search `profiles` table for matching phone
  - If found, insert `app_notifications` record
  - Optionally invoke `send-communication` for SMS

### Phase 2 — Fix Gap 2: Recurring Payments Cron
- Create new edge function `recurring-payments-cron`
- Create new DB table `recurring_payment_executions` for audit trail
- Wire to Supabase pg_cron (hourly check)
- Process due payments via `api-transfers` or `api-bills-v2`

### Phase 3 — Fix Gap 4 & 5: Console Warnings
- Fix AnimatePresence key collision in `Auth.tsx`
- Add null-safety in `useOneSignal.ts`

### No changes to:
- Any existing edge functions
- Any existing DB schemas
- Any existing routes
- Any existing UI components (except the 4 targeted fixes)

