---
name: Credit Score Sync & No-Score CTA Audit
description: E2E audit ensuring all 3 apps display the right CrediQ score and prompt unscored users to start an assessment
type: feature
---

# Credit Score Sync & "No Score" CTA — E2E Audit (v1.1.0)
**Date:** 2026-04-18
**Scope:** Customer App (`/app/credit`) · Banking App (`/bank/more/credit`) · Dashboard (`/dashboard`) · CrediQ Dashboard (`/crediq`)

---

## 1. Gap Analysis

| ID | Severity | Area | Gap | Status |
|---|---|---|---|---|
| **H1** | 🔴 Critical | `useDashboardData.fetchCreditScore` | Read directly from legacy `credit_scores` table, bypassing the canonical engine — Dashboard showed a different score than the Customer/Banking apps | ✅ FIXED |
| **H2** | 🟠 High | All apps | New users (no profile) saw `score: 0` / `—` with no path forward — no CTA to start an assessment | ✅ FIXED (NoCreditScoreCTA) |
| **H3** | 🟠 High | `credit-score-fetch` | When a user had events but no profile, the function returned 0 instead of auto-triggering the engine | ✅ FIXED (auto-init) |
| **H4** | 🟡 Medium | All hooks | Score not refreshed when user returns to the tab — could show stale data | ✅ FIXED (`refetchOnWindowFocus: true`) |
| **H5** | 🟡 Medium | `Dashboard.tsx` widget grid | Credit score widget hidden when score=0 — no opportunity to convert | ✅ FIXED (CTA replaces widget) |

---

## 2. Implemented Fixes

### Fix 1: Unified score source (H1)
`src/hooks/useDashboardData.ts` now invokes `credit-score-fetch` instead of reading the legacy
`credit_scores` table directly. The web Dashboard and the Customer/Banking apps now show the
exact same score from the same engine.

### Fix 2: Reusable `NoCreditScoreCTA` component (H2)
`src/components/credit/NoCreditScoreCTA.tsx` — three professional variants:
- **`customer`**: friendly pastel card with three benefit chips (Soft check · Free · 60 sec)
- **`banking`**: bank palette (`--bank-sky`) for the lender lens
- **`dashboard`**: compact horizontal card matching the web design tokens

A single click invokes `credit-recompute`, which drives the deterministic engine and toasts the
resulting score (or a friendly empty-state message). Cache keys are invalidated automatically.

### Fix 3: Auto-init in `credit-score-fetch` (H3)
The fetcher now detects "no profile yet, but events present" and transparently flips
`force_refresh = true` so the engine runs the very first time the user opens the page — no
manual button needed.

### Fix 4: Refetch on window focus (H4)
- `useCustomerCreditScore` (mobile) → `refetchOnWindowFocus: true`
- `useCreditScore` (banking) → `refetchOnWindowFocus: true`
This keeps the score in sync across tabs and when returning to the app.

### Fix 5: Dashboard CTA placement (H5)
`Dashboard.tsx` now renders the `NoCreditScoreCTA` in the widget grid slot whenever
`creditScore` is null, instead of silently hiding the widget.

---

## 3. Files Touched

- **New:** `src/components/credit/NoCreditScoreCTA.tsx`
- `supabase/functions/credit-score-fetch/index.ts`
- `src/hooks/useDashboardData.ts`
- `src/hooks/useCustomerData.ts`
- `src/hooks/useBankingData.ts`
- `src/pages/customer-app/CustomerCreditScore.tsx`
- `src/pages/banking-app/BankCreditScore.tsx`
- `src/pages/Dashboard.tsx`

---

## 4. Verification

- ✅ `credit-score-fetch` redeployed
- ✅ All three apps now read from the same engine endpoint
- ✅ Unscored users see a clear, professional "Start free assessment" CTA in every surface
- ✅ Returning to a tab triggers a background refresh
