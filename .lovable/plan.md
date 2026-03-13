

# Credit Score Page Redesign + Full Report Paywall

## Overview

Redesign the `/credit-score` page with a modern, professional UI inspired by the uploaded Credit Karma / DisputeFox style images. Add a paid "Full Credit Report" feature where admin sets the fee via the existing fee management system, and users must pay to unlock the full report + loan eligibility.

## Design Direction (from reference images)

- **Hero section**: Vibrant gradient background (green-to-teal, matching brand primary) with a large animated circular score gauge, score label, and change indicator
- **Impact factor cards**: Grid of rounded white cards with icon badges, large metric numbers, and impact level indicators (High/Medium/Low) — inspired by CreditKarma's factor grid
- **Score history**: Dark-themed section with line chart and time-range toggle pills (3mo / 6mo / 1yr)
- **Full Report CTA**: Prominent paywall card with blurred preview of report data, unlock button showing admin-set fee
- **Pre-approved offers**: Colorful offer cards below the score (already exists, will be moved behind paywall)

## Database Changes

### 1. Add `credit_report_purchase` transaction type to fee_structures
- Add a new `fee_structures` row via migration seed (or admin can create via existing wizard) with `transaction_type: 'credit_report_purchase'`, `fee_scope: 'platform'`, `fee_model: 'fixed'`
- This integrates with existing `useFeeEstimate` hook and admin fee management

### 2. Create `credit_report_purchases` table
```sql
CREATE TABLE public.credit_report_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'pending', -- pending, completed, failed
  payment_method text,
  report_type text NOT NULL DEFAULT 'full',
  purchased_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.credit_report_purchases ENABLE ROW LEVEL SECURITY;
-- Users can read their own purchases
CREATE POLICY "Users read own purchases" ON public.credit_report_purchases
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Users can insert their own purchases
CREATE POLICY "Users insert own purchases" ON public.credit_report_purchases
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
```

### 3. Add `credit_report_purchase` to transaction types
Add to the `TRANSACTION_TYPES` array in `CreateFeeStructureForm.tsx` and `CHANNEL_TO_TX_TYPE` in `useFeeEstimate.ts`.

### 4. Seed default fee structure
```sql
INSERT INTO public.fee_structures (transaction_type, fee_scope, fee_model, fixed_amount, percentage_rate, is_active, currency)
VALUES ('credit_report_purchase', 'platform', 'fixed', 2500, 0, true, 'XAF');
```

## UI Changes

### A. Redesigned `CreditScore.tsx` — Complete page overhaul

**Hero Section** (inspired by CreditKarma green gradient):
- Full-width gradient header (primary → teal) with rounded bottom corners
- Enhanced `CircularScoreDisplay` centered with animated entrance
- Score change badge, score band label, last updated date
- Action buttons: Refresh, Get AI Tips

**Impact Factor Cards** (new component: `CreditFactorGrid.tsx`):
- 2×3 grid of white rounded cards on the gradient background
- Each card: colored icon badge, factor name, large metric value, impact level dots (●●● High, ●●○ Medium, ●○○ Low)
- Cards: Payment History, Credit Utilization, Derogatory Marks, Credit Age, Total Accounts, Hard Inquiries
- Subtle hover animations (scale + shadow)

**Quick Stats Row**:
- Two white floating cards: "Net Worth" equivalent (Total Savings) and "Total Debt" (Outstanding Loans) with arrow icons

**Score History Section** (dark background, inspired by image 3):
- Dark card with time-range toggle pills (3 month / 6 month / 1 year)
- Area chart with gradient fill and tooltip

**Full Report Paywall Card** (new component: `FullReportPaywall.tsx`):
- Prominent card showing blurred preview of report sections
- Lock icon, "Unlock Full Credit Report" heading
- Fee amount from `useFeeEstimate({ channel: 'credit_report_purchase' })`
- "Pay & Unlock" button → deducts from wallet, creates purchase record, redirects to `/credit-report`
- If already purchased (valid, not expired): shows "View Full Report" button instead

**Pre-Approved Offers** (moved behind paywall):
- Show teaser with blur if report not purchased
- Full access after purchase

### B. Enhanced `CircularScoreDisplay.tsx`
- Add pulsing glow animation on the indicator dot
- Add subtle rotation animation on the gradient
- Smoother spring-based entrance animation

### C. New Component: `CreditFactorGrid.tsx`
- Renders the 6-card Bento grid inspired by CreditKarma
- Maps score component data to visual cards with impact indicators
- Staggered fade-in animations per card

### D. New Component: `FullReportPaywall.tsx`
- Checks `credit_report_purchases` for active (non-expired) purchase
- Shows fee via `useFeeEstimate`
- Handles payment flow: deduct from wallet balance → insert purchase → navigate to report
- Blurred preview of report sections behind overlay

### E. Updated `useFeeEstimate.ts`
- Add `credit_report_purchase` to `CHANNEL_TO_TX_TYPE` map

### F. Updated `CreateFeeStructureForm.tsx`
- Add `credit_report_purchase` to `TRANSACTION_TYPES` array under a "Services" category

## Files Changed

| File | Change |
|------|--------|
| `src/pages/CreditScore.tsx` | Full redesign with new layout, gradient hero, factor grid, paywall |
| `src/components/credit/CircularScoreDisplay.tsx` | Enhanced animations (pulse glow, smoother spring) |
| `src/components/credit/CreditFactorGrid.tsx` | **New** — Bento-style impact factor cards |
| `src/components/credit/FullReportPaywall.tsx` | **New** — Paywall with fee lookup, purchase flow |
| `src/components/credit/ScoreTrendChart.tsx` | Dark theme variant, time-range toggle |
| `src/hooks/useFeeEstimate.ts` | Add `credit_report_purchase` channel mapping |
| `src/components/fee-management/CreateFeeStructureForm.tsx` | Add `credit_report_purchase` transaction type |
| **Migration** | Create `credit_report_purchases` table + seed fee structure |

