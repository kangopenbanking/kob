

# Plan: Pre-Approved Loans & Hard/Soft Credit Check Enhancement

## Overview

This plan adds two major features to the credit scoring system:

1. **Pre-Approved Loan Offers** — Banks configure credit score benchmarks. When a customer's score meets the threshold, pre-approved loan offers automatically appear on their Credit Score page. Customers can apply directly or open a new account if not banking with that institution.

2. **Hard & Soft Credit Check Management** — A dedicated Credit Inquiries section on the Credit Score and Credit Report pages showing categorized hard/soft checks with score impact tracking.

---

## Database Changes

### New Table: `preapproved_loan_offers`
Managed by banks via the FI Portal. Stores benchmark rules that generate offers for eligible customers.

```sql
CREATE TABLE preapproved_loan_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id),
  product_name TEXT NOT NULL,
  description TEXT,
  min_credit_score INTEGER NOT NULL,        -- benchmark threshold
  max_credit_score INTEGER DEFAULT 850,
  min_amount NUMERIC NOT NULL DEFAULT 50000,
  max_amount NUMERIC NOT NULL DEFAULT 5000000,
  interest_rate_annual NUMERIC NOT NULL,
  max_tenure_months INTEGER NOT NULL DEFAULT 36,
  currency TEXT NOT NULL DEFAULT 'XAF',
  requires_existing_account BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### New Table: `preapproved_loan_applications`
Tracks when customers apply for a pre-approved offer.

```sql
CREATE TABLE preapproved_loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES preapproved_loan_offers(id),
  user_id UUID NOT NULL,
  institution_id UUID NOT NULL REFERENCES institutions(id),
  requested_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',  -- pending_review, hard_check_initiated, approved, declined
  credit_score_at_application INTEGER,
  hard_inquiry_id UUID REFERENCES credit_inquiries(id),
  decline_reason TEXT,
  score_impact INTEGER,  -- impact on score if declined after hard check
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

RLS: Users see their own applications; institution staff see their institution's offers/applications; service_role for edge functions.

---

## Frontend Changes

### 1. New Component: `PreApprovedOffersCard` (`src/components/credit/PreApprovedOffersCard.tsx`)
- Fetches active `preapproved_loan_offers` from all institutions where user's credit score >= `min_credit_score`
- Displays each offer as a card showing: Bank name, product name, rate, max amount, eligibility badge
- "Apply" button opens a dialog with amount selection
- If user has no account with that bank, shows "Open Account & Apply" option
- Warns that application triggers a **hard credit check** that may impact their score

### 2. New Component: `CreditInquiriesPanel` (`src/components/credit/CreditInquiriesPanel.tsx`)
- Replaces the basic inquiry rows in the Credit Report with a full panel
- Two tabs: **Hard Checks** | **Soft Checks**
- Hard checks show: inquirer name, date, purpose, score impact, status badge (red)
- Soft checks show: inquirer name, date, purpose (green/neutral badge)
- Summary stats: total hard/soft in 6m and 12m, estimated score impact from hard checks
- Timeline visualization

### 3. Update `CreditScore.tsx`
- Add `PreApprovedOffersCard` in the right sidebar (after LinkedAccountsWidget)
- Add a "Credit Inquiries" quick stat in the hero section showing hard/soft counts

### 4. Update `CreditReport.tsx`
- Replace the basic inquiry rows section with the enhanced `CreditInquiriesPanel`
- Add a "Pre-Approved Offers" section at the bottom

### 5. Update `CreditActivityFeed.tsx`
- Add `pre_approved` activity type with dedicated icon
- Show hard check events with score impact

---

## Backend Changes

### 1. New Edge Function Action in `credit-ops`: `preapproved-offers`
- Accepts user's credit score, returns matching active offers from all institutions
- Joins with `institutions` table for bank name/logo
- Logs as **soft inquiry** (browsing offers doesn't impact score)

### 2. New Edge Function Action in `credit-ops`: `apply-preapproved`
- Validates offer eligibility (score still meets benchmark)
- Creates `preapproved_loan_applications` record
- Logs a **hard inquiry** in `credit_inquiries` with `inquiry_type: 'hard'`
- Returns application reference to the user
- If declined after bank review, triggers score impact via credit event

### 3. FI Portal: Add "Pre-Approved Offers" Management
- New tab/section in the FI Portal loans area
- CRUD for `preapproved_loan_offers` — set benchmark scores, amounts, rates
- View applications received from the marketplace
- Approve/decline with hard check impact logging

---

## Hard/Soft Check Enhancement Details

- **Soft checks** (no score impact): Self-checks, browsing pre-approved offers, account monitoring
- **Hard checks** (score impact: -2 to -10 points): Loan applications, pre-approved loan applications, third-party credit queries
- Hard check impact decays over 12 months (already partially modeled in the credit engine)
- The `credit_inquiries` table already has `inquiry_type` (hard/soft) — we enhance the UI to properly surface this data

---

## Technical Notes

- No changes to frozen core functions
- Pre-approved offers use existing `institutions` table for bank identity
- The application flow reuses the existing `loan-ops` apply logic where possible
- All new tables get proper RLS policies
- Hard inquiry logging reuses existing `credit_inquiries` infrastructure

