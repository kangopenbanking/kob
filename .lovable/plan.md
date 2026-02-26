

## Verification Results & Gaps Found

After reviewing the full codebase, here is the status of each requested feature:

### Already Fully Wired (No Changes Needed)

1. **Home Page** — Fetches real accounts, balances, transactions, savings, loans, and credit score via `useBankAccounts`, `useBankTransactions`, `useSavingsAccounts`, `useLoanApplications`, `useCreditScore` hooks. No mock data remains.

2. **Send Money** — Calls `api-transfers` edge function via `useSendTransfer` hook with real `source_account_id` from user's primary account.

3. **Mobile Money** — Calls `mobile-money-charge` edge function via `useMobileMoneyCharge` hook, passing `phone_number`, `amount`, `currency`, and `provider`.

4. **Savings** — Queries `savings_accounts` table via `useSavingsAccounts`, creates goals via `savings-create`, deposits via `savings-deposit`, withdraws via `savings-withdraw`.

5. **Loans** — Queries `loan_applications` and `loan_products` tables, applies via `loan-apply` edge function.

6. **Credit Score** — Calls `credit-score-fetch` edge function via `useCreditScore` hook, maps `score_factors` to display.

7. **History** — Fetches real transactions (limit 50), groups by date, search/filter client-side. Export button calls `generate-bank-statement` edge function.

---

### Gap Found: Multi-Tenancy Data Isolation

**Critical Issue**: The `useBankingData.ts` hooks fetch `institutionId` from URL params but **never pass it as a filter** to database queries. This means:

- `useBankAccounts` reads `institutionId` but doesn't filter `accounts` by `institution_id`
- All other hooks (`useBankTransactions`, `useSavingsAccounts`, `useLoanApplications`) don't filter by institution at all
- Data is only filtered by `user_id`, not by institution — so a user in Bank A could see data from Bank B

### Implementation Plan

**1. Fix multi-tenancy filtering in `useBankingData.ts`**
- Add `.eq('institution_id', institutionId)` filter to `useBankAccounts` query
- Pass `institutionId` to `useBankTransactions`, `useSavingsAccounts`, `useLoanApplications` hooks and filter queries accordingly
- Include `institutionId` in query keys for all hooks so data re-fetches when switching banks
- Pass `institution_id` in the request body to edge function calls (`api-transfers`, `mobile-money-charge`, `savings-create`, `loan-apply`, `credit-score-fetch`, `generate-bank-statement`)

**2. Update page components to pass `institutionId`**
- Ensure all pages that call hooks which need institution context extract `institutionId` from `useParams()` and pass it through

**3. No admin portal changes needed**
- The admin portal already has full institution management via the existing Admin Portal RBAC system (transaction monitoring, merchant management, etc.)
- Each banking app instance is already tenant-scoped via the URL pattern `/bank/:institutionId/*` and the `TenantProvider` handles branding

### Files to Edit
- `src/hooks/useBankingData.ts` — Add `institution_id` filtering to all 6 query hooks and pass it in all 6 mutation bodies

