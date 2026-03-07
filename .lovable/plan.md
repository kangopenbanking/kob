# Limits & Charges Management — Implementation Plan

## Overview

Add a new **"Limits & Charges"** tab to the admin Fee Management page. This tab provides a comprehensive configuration UI for 8 transaction categories (Send Money, Cash In, Cash Out, Mobile Recharge, Bank Transfer, Payment Charges, Invoice Create Charge, API Payment Charge), each with its own set of charges, limits, and referral commissions.

## Database

### New table: `fee_limits_charges`

Stores one row per transaction category with all configurable fields:


| Column                         | Type                      | Notes                                                                                                                            |
| ------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`                           | uuid PK                   | &nbsp;                                                                                                                           |
| `category`                     | text NOT NULL UNIQUE      | e.g. `send_money`, `cash_in`, `cash_out`, `mobile_recharge`, `bank_transfer`, `payment_charges`, `invoice_create`, `api_payment` |
| `percentage_charge`            | numeric DEFAULT 0         | &nbsp;                                                                                                                           |
| `fixed_charge`                 | numeric DEFAULT 0         | &nbsp;                                                                                                                           |
| `min_amount`                   | numeric DEFAULT 0         | &nbsp;                                                                                                                           |
| `max_amount`                   | numeric DEFAULT 0         | &nbsp;                                                                                                                           |
| `daily_limit`                  | numeric DEFAULT -1        | -1 = unlimited                                                                                                                   |
| `monthly_limit`                | numeric DEFAULT -1        | &nbsp;                                                                                                                           |
| `daily_request_accept_limit`   | numeric DEFAULT -1        | Send Money only                                                                                                                  |
| `monthly_request_accept_limit` | numeric DEFAULT -1        | Send Money only                                                                                                                  |
| `max_charge_cap`               | numeric DEFAULT -1        | -1 = no cap                                                                                                                      |
| `agent_commission_fixed`       | numeric DEFAULT 0         | Cash In/Out only                                                                                                                 |
| `agent_commission_percent`     | numeric DEFAULT 0         | Cash In/Out only                                                                                                                 |
| `referral_percent_commission`  | numeric DEFAULT 0         | &nbsp;                                                                                                                           |
| `referral_fixed_commission`    | numeric DEFAULT 0         | &nbsp;                                                                                                                           |
| `merchant_percent_charge`      | numeric DEFAULT 0         | Payment Charges only                                                                                                             |
| `merchant_fixed_charge`        | numeric DEFAULT 0         | Payment Charges only                                                                                                             |
| `user_percent_charge`          | numeric DEFAULT 0         | Payment Charges only                                                                                                             |
| `user_fixed_charge`            | numeric DEFAULT 0         | Payment Charges only                                                                                                             |
| `daily_count_limit`            | integer DEFAULT -1        | Invoice create count limit                                                                                                       |
| `is_active`                    | boolean DEFAULT true      | &nbsp;                                                                                                                           |
| `updated_at`                   | timestamptz DEFAULT now() | &nbsp;                                                                                                                           |
| `updated_by`                   | uuid                      | &nbsp;                                                                                                                           |


RLS: Read for authenticated, write restricted to admins via `has_role()`.

Seed the 8 categories with default zero/unlimited values so the admin always has rows to edit.

## Frontend Changes

### 1. New component: `LimitsChargesTab.tsx`

- Fetches all rows from `fee_limits_charges` on mount
- Renders an **accordion** with 8 sections (Send Money, Cash In, Cash Out, etc.)
- Each section shows its relevant fields as labeled inputs in a responsive grid
- Fields use the `Input` component with `type="number"`, appropriate labels, and "XAF" or "%" suffixes
- Helper text "-1 for unlimited" shown on limit fields
- Each section has a **Save** button that updates that category's row
- Success/error toasts on save

### 2. Update `FeeManagement.tsx`

- Add a 6th tab: `Limits & Charges` with a `Sliders` icon
- Import and render `<LimitsChargesTab />` in the new `TabsContent`

### 3. Category field mapping

Each accordion section only shows fields relevant to that category:

- **Send Money**: percentage_charge, fixed_charge, min_amount, max_amount, daily_limit, daily_request_accept_limit, monthly_limit, monthly_request_accept_limit, referral_percent_commission, referral_fixed_commission, max_charge_cap
- **Cash In**: min_amount, max_amount, agent_commission_fixed, agent_commission_percent, daily_limit (money in), monthly_limit (money in)
- **Cash Out**: percentage_charge, fixed_charge, min_amount, max_amount, agent_commission_fixed, agent_commission_percent, daily_limit, monthly_limit, referral_percent_commission, referral_fixed_commission
- **Mobile Recharge**: percentage_charge, fixed_charge, min_amount, max_amount, referral_percent_commission, referral_fixed_commission
- **Bank Transfer**: percentage_charge, fixed_charge, min_amount, max_amount, daily_limit, monthly_limit, referral_percent_commission, referral_fixed_commission
- **Payment Charges**: merchant_percent_charge, merchant_fixed_charge, user_percent_charge, user_fixed_charge, max_charge_cap, referral_percent_commission, referral_fixed_commission
- **Invoice Create**: percentage_charge, fixed_charge, min_amount, max_amount, daily_count_limit, max_charge_cap
- **API Payment**: percentage_charge, fixed_charge, max_charge_cap

## Summary of file changes


| Action       | File                                                                                                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DB migration | Create `fee_limits_charges` table + seed 8 rows + RLS                                                                                                                                                                                                                                                                                |
| Create       | `src/components/fee-management/LimitsChargesTab.tsx`                                                                                                                                                                                                                                                                                 |
| Edit         | `src/pages/FeeManagement.tsx` — add tab&nbsp;&nbsp;Implement the full fee management plan: add fee_scope to the database, make gateway-adapters.ts dynamic, upgrade the admin Fee Management page with Platform/Merchant/API scopes, and replace all hardcoded fees across the 6 frontend pages with a shared useFeeEstimate hook |
