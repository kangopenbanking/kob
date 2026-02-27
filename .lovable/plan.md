

## Audit Results & Implementation Plan: Banking App More Section

### Gaps Identified

After a thorough audit of every page linked from the Banking App's More section and the full PWA, here are the gaps found:

| Page | Status | Issue |
|------|--------|-------|
| BankAlerts | Incomplete | Uses hardcoded mock data. No real notifications fetched from database |
| BankHelp | Incomplete | Static menu items with no onClick handlers. FAQs don't expand, Call/Email don't trigger actions |
| BankQRPay | Placeholder | Static QR icon placeholder. No actual QR code generation or scanning |
| BankReceive | Minor gap | Missing `institution_id` filter on account query -- can leak cross-tenant data |
| Admin Management | Missing tabs | No KYC/Customers, Virtual Cards, Credit Scores, or App Users/Analytics tabs |

All other pages (BankHome, BankPayments, BankSendMoney, BankMobileMoney, BankBills, BankCards, BankHistory, BankFundAccount, BankSavings, BankNewSavings, BankLoans, BankCreditScore, BankSettings, BankSplash, BankAuth, BankApply, BankKYC) are fully functional.

---

### Implementation Steps

#### Step 1: Fix BankAlerts -- Real Notifications
File: `src/pages/banking-app/BankAlerts.tsx`

- Fetch real data from `funding_events`, `transactions`, and `kyc_verifications` tables scoped by `user_id`
- Display recent activity as notifications (funding created, transfer completed, KYC status changes)
- Keep the existing UI design (motion cards, icon/color mapping) but populate with real data
- Add empty state when no notifications exist
- Add pull-to-refresh via query invalidation

#### Step 2: Fix BankHelp -- Interactive Help Page
File: `src/pages/banking-app/BankHelp.tsx`

- Add expandable FAQ accordion section with common banking questions (using Radix Accordion)
- Wire "Call Us" to `tel:` link and "Email Support" to `mailto:` link
- Wire "Live Chat" to open a simple in-app support form that submits to a `support_tickets` concept (toast confirmation)
- Use `useTenant()` to pull institution-specific support contact info if available

#### Step 3: Fix BankQRPay -- Functional QR Code
File: `src/pages/banking-app/BankQRPay.tsx`

- Generate a real QR code containing the user's account ID using a simple SVG-based QR renderer (inline implementation, no new dependency)
- Add amount input field for payment-request QR codes
- "Scan QR Code" button opens device camera via `navigator.mediaDevices` (or shows toast that scanning requires native app)
- Include share functionality for the generated QR image

#### Step 4: Fix BankReceive -- Add Institution Scoping
File: `src/pages/banking-app/BankReceive.tsx`

- Add `useParams()` to get `institutionId`
- Filter account query by both `user_id` AND `institution_id` to prevent cross-tenant data leakage

#### Step 5: Enhance Admin BankingAppManagement -- Add Missing Tabs
File: `src/pages/admin/BankingAppManagement.tsx`

Add 4 new data hooks and corresponding tabs:

**5a. KYC/Customers Tab**
- New hook `useInstitutionCustomers` -- queries `profiles` joined through `accounts` for the institution
- Displays customer name, email, KYC status, account count, join date
- Links to KYC verification status from `kyc_verifications` table

**5b. Virtual Cards Tab**
- New hook `useInstitutionCards` -- queries `virtual_cards` through institution-scoped accounts
- Displays card number (masked), type, balance, status, creation date
- Shows total active cards in stats grid

**5c. Credit Scores Tab**
- New hook `useInstitutionCreditScores` -- queries `crediq_scores` through institution-scoped users
- Displays user, score, score range, last calculated date
- Shows average score in stats grid

**5d. App Users Tab**
- New hook `useInstitutionUsers` -- queries unique users from `accounts` table with profile info
- Displays total registered users, active accounts per user, last activity
- Add stat card for total users to the overview grid

**Stats Grid Update**: Expand from 5 to 8 stat cards:
- Add: Virtual Cards count, Average Credit Score, Total Customers

**Tab Bar Update**: Add 4 new tab triggers: Customers, Cards, Credit Scores, Users

### Technical Notes
- All new queries are scoped by `institution_id` to maintain multi-tenancy isolation
- No database changes required -- all data exists in current tables
- No new dependencies needed
- Existing code structure, route definitions, and component patterns are preserved
- Admin tabs follow the exact same Card > Table pattern used by existing tabs

