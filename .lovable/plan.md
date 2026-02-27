

## Full Production Audit: Loans, Savings & Credit Score System

### Critical Gaps Found

#### GAP 1: Two Disconnected Credit Score Systems
The codebase has **two completely separate credit scoring systems** that do NOT talk to each other:
- **System A (Legacy CrediQ)**: `credit-score-calculate` + `credit-score-fetch` -- writes to `credit_scores`, `credit_score_history`, `credit_inquiries`, `credit_reports`. Used by ALL frontend pages (`CreditScore.tsx`, `BankCreditScore.tsx`, `loan-apply`).
- **System B (New Event-Sourced)**: `credit-score-engine` -- writes to `credit_events`, `credit_profiles`, `credit_score_snapshots`. Called by `loan-repay`, `savings-deposit`, `savings-withdraw`, `loan-overdue-detect`. **Not consumed by ANY frontend page**.

**Result**: Users never see the impact of their repayments/deposits on their credit score. The scores are computed and stored but invisible.

#### GAP 2: `loan-repay` Missing Idempotency-Key Header from Frontend
`LoanRepaymentForm.tsx` calls `supabase.functions.invoke('loan-repay')` but does NOT send the required `Idempotency-Key` header. The edge function returns 400 "missing_idempotency_key" every time.

#### GAP 3: `LoanAccountCard.tsx` Queries Wrong Tables
It queries `loan_repayment_schedules` and `loan_payments`, but the actual tables are `loan_schedule` and `loan_repayments`. These queries silently fail and return empty results.

#### GAP 4: `savings-create` Does Not Set `institution_id`
The `savings-create` edge function never sets `institution_id` on the `savings_accounts` row. This breaks multi-tenant scoping -- savings accounts created in `/bank/:institutionId` have no institution linkage. The `useSavingsAccounts` hook filters by `institution_id`, so accounts appear missing.

#### GAP 5: `loan-apply` Does Not Set `institution_id`
Same issue -- `loan-apply` doesn't persist `institution_id` on `loan_applications`. The `useLoanApplications` hook filters by `institution_id`, so applications vanish in the banking app.

#### GAP 6: New Credit API Endpoints Not in API Catalog or Docs
`credit-profile-get`, `credit-events-list`, `credit-explain`, `credit-recompute` edge functions exist but are absent from:
- `ApiDocumentation.tsx`
- `ApiTesting.tsx`
- `ApiCatalog.tsx`
- Any frontend page

#### GAP 7: `BankCreditScore.tsx` Shows Old CrediQ Factors, Not Event-Sourced Data
It calls `credit-score-fetch` which returns legacy `score_factors` (payment_history, credit_utilization, account_age, inquiries). It does NOT show the new event-sourced factors from `credit_score_snapshots.factors_json`.

#### GAP 8: No Repayment UI in Banking App
`BankLoans.tsx` shows applications and products but has NO repayment button or form. Users in the multi-tenant banking app cannot make loan repayments.

#### GAP 9: `config.toml` Missing New Edge Functions
The new functions (`credit-score-engine`, `credit-profile-get`, `credit-events-list`, `credit-explain`, `credit-recompute`, `loan-overdue-detect`) are not registered in `supabase/config.toml` with `verify_jwt = false` settings, which means they may reject valid service-role calls.

#### GAP 10: `savings-deposit`/`savings-withdraw` Use Legacy `serve()` Import
These use `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"` while the newer functions use `Deno.serve()`. This is not a blocker but inconsistent.

#### GAP 11: No Credit Score Feedback After Deposit/Withdraw in Banking App
After a successful deposit or withdrawal, `BankSavings.tsx` shows a toast but does NOT display the credit score delta returned by the backend.

#### GAP 12: InstitutionLoans Fetches Repayments with Wrong Key
`InstitutionLoans.tsx` line 37 queries `loan_repayments` with `.in("loan_id", appIds)` where `appIds` are application IDs, not loan account IDs. This returns zero results.

---

### Implementation Plan (Step-by-Step Fixes)

#### Step 1: Unify Credit Score Systems
- Update `credit-score-fetch` to ALSO read from `credit_profiles` and merge the new event-sourced score when available (prefer event-sourced if `last_computed_at` is recent)
- Add `factors_json` from latest `credit_score_snapshots` to the response
- This ensures all existing UI gets the event-sourced score without changing any frontend routes

#### Step 2: Fix `loan-repay` Idempotency-Key
- Update `LoanRepaymentForm.tsx` to generate and send an `Idempotency-Key` header via custom fetch or by passing headers to `supabase.functions.invoke`

#### Step 3: Fix `LoanAccountCard.tsx` Table Names
- Change `loan_repayment_schedules` to `loan_schedule`
- Change `loan_payments` to `loan_repayments`
- Fix column references accordingly

#### Step 4: Fix `savings-create` Institution ID
- Accept `institution_id` from request body and persist it to `savings_accounts`

#### Step 5: Fix `loan-apply` Institution ID
- Accept `institution_id` from request body and persist it to `loan_applications`

#### Step 6: Add Repayment UI to BankLoans
- Add a "Make Payment" button on active loan cards in `BankLoans.tsx` that opens a repayment dialog using `supabase.functions.invoke('loan-repay')`
- Display credit score delta in success feedback

#### Step 7: Update BankCreditScore to Show Event-Sourced Data
- Update `BankCreditScore.tsx` to display `factors_json` from the unified response
- Add credit events timeline section showing recent `credit_events`

#### Step 8: Add Credit Score Feedback to BankSavings
- After deposit/withdraw success, show credit score delta from the response in the toast

#### Step 9: Fix InstitutionLoans Repayments Query
- First fetch `loan_accounts` by application IDs, then query `loan_repayments` by loan account IDs

#### Step 10: Register New Endpoints in API Docs
- Add `credit-profile-get`, `credit-events-list`, `credit-explain`, `credit-recompute` to `ApiDocumentation.tsx`, `ApiTesting.tsx`, and `ApiCatalog.tsx`

#### Step 11: Update config.toml
- Add `verify_jwt = false` entries for all new edge functions that validate auth internally

#### Step 12: Add useCreditProfile Hook
- Create hook in `useBankingData.ts` that calls `credit-profile-get` for the new event-sourced profile
- Create `useCreditEvents` hook calling `credit-events-list`

#### Step 13: Update Changelog and Documentation
- Update `docs/changelog.md` and `docs/changelog.json` with all fixes
- Update `docs/loans-savings-credit/gap-report.md` with newly discovered gaps

#### Step 14: E2E Integration Testing
- Create comprehensive test file covering the full flow: deposit -> check credit event created -> verify score change visible in UI
- Test loan apply -> approve -> disburse -> repay -> verify credit score updated
- Test multi-tenancy: verify institution_id scoping works for savings and loans

