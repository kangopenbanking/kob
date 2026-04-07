

# Consumer PWA Super Audit -- Comprehensive E2E Plan

## Scope

The Consumer App has **44 routes** and **20+ edge function integrations**. This audit will systematically verify every feature, fix gaps, and test before moving to the next. Features are grouped into phases by domain.

---

## Audit Methodology

For each feature, the following checklist applies:

1. **Route loads** -- no crash, no blank screen, proper loading states
2. **Data persistence** -- CRUD operations write to and read from DB correctly
3. **Error handling** -- professional toast messages (no raw edge function errors)
4. **Edge function integration** -- correct payloads, proper response parsing
5. **PIN gating** -- all financial operations gated by PinConfirmDialog
6. **Idempotency** -- money-moving operations include idempotency keys
7. **Empty states** -- actionable UI when no data exists
8. **RLS compliance** -- users can only see/modify their own data
9. **Balance sync** -- financial ops trigger refetchQueries (not invalidateQueries)
10. **Mobile UX** -- proper back navigation, scrolling, no clipped elements

---

## Phase 1 -- Authentication and Onboarding
- CustomerAuth (phone login, OTP, PIN, captcha)
- CustomerRegister (signup flow)
- CustomerOnboarding (KYC wizard)
- CustomerSplash (landing/redirect)

## Phase 2 -- Core Financial Operations
- CustomerHome (balance display, navigation)
- CustomerTransfer (P2P transfers -- phone/account/name/RIB/IBAN)
- CustomerFundWallet (add money -- MoMo/card/bank/PayPal)
- CustomerCashOut (withdraw to linked accounts)
- CustomerSendMoney (remittance wizard)
- CustomerRemittances (remittance history)

## Phase 3 -- Bills and Payments
- CustomerBillsV2 (utility bill payments, provider directory)
- CustomerInvoices (create/send/pay invoices)
- CustomerSplitBills (split, search users, pay share)
- CustomerRecurring (auto-pay subscriptions)
- CustomerPayLinks (payment links)

## Phase 4 -- Savings and Financial Health
- CustomerPiggyBank (bank savings, personal goals)
- CustomerNjangi (group savings circles)
- CustomerCreditScore (score, insights, pre-approved offers)
- CustomerRentReporting (rent history for credit)
- CustomerRewards (cashback, coupons, referrals)
- CustomerLoyalty (points, redemption)

## Phase 5 -- Cards and Accounts
- CustomerCards (virtual cards, freeze/unfreeze)
- CustomerLinkedAccounts (link bank accounts)
- CustomerBank (add money sources)

## Phase 6 -- Commerce and Marketplace
- CustomerStores (browse merchants)
- CustomerStoreDetail (product listing, add to cart)
- CustomerCart (checkout flow)
- CustomerOrderTracking (order status)
- CustomerMarketplace (search, filter, favorites)
- CustomerWishlist (saved stores/products)
- CustomerReviews (rate orders)

## Phase 7 -- Travel
- CustomerTravelCategories (browse travel types)
- CustomerTravelAgencies (service providers)
- CustomerTravelTrips (available trips)
- CustomerTravelBooking (book and pay)
- CustomerTravelTicket (view ticket)
- CustomerTravelHistory (past bookings)

## Phase 8 -- Communication and Support
- CustomerSupport (live chat, departments)
- CustomerHelp (FAQ, quick links)
- CustomerAlerts (notifications)
- CustomerDisputes (file/track disputes)

## Phase 9 -- Settings and Scan
- CustomerSettings (profile, security, PIN, language, legal)
- CustomerScan (QR code scanning -- kob_pay, kob_pos_pay, kob_store)
- CustomerRequest (QR code generation for receiving)
- CustomerActivity (transaction history)
- PayByBankApproval (PISP authorization)

---

## Deliverables

Each phase produces:
- Gaps identified (numbered list)
- Fixes applied (code changes)
- Verification test (edge function curl or UI confirmation)
- Score per feature (Pass / Partial / Fail)

Final output: **Feature scorecard** with pass rate across all 44 routes.

---

## Technical Approach

- Read each page file fully and trace all edge function calls
- Query DB for schema/data alignment
- Test edge functions via `curl_edge_functions`
- Fix error handling, missing PIN gates, broken queries, dead features
- One feature at a time, verified before moving on

---

## Execution Order

Will start with **Phase 1 (Auth)** and proceed sequentially. Each phase is a discrete unit of work with its own test cycle. Estimated: 9 phases, working through them systematically.

