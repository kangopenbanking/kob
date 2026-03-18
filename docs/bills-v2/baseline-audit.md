# Bills v2 — Baseline Audit
> Generated: 2026-03-18

## Current Flow Map

### Consumer App (`/app/bills`)
- **CustomerBills.tsx**: Hardcoded 6 categories (Electricity, Water, Internet, TV, Phone, Insurance)
- Each category has hardcoded biller strings (e.g., 'ENEO', 'CamWater')
- Payment flow: Category → Biller → Account/Amount → PIN → Direct DB insert
- Balance deduction: Non-atomic `UPDATE` on `account_balances`
- No receipt screen, no trace_id, no payment intent pattern
- No provider directory, no dynamic fields

### Banking App (`/banking/payments/bills`)
- **BankBills.tsx**: Similar hardcoded approach, calls `api-bills` edge function
- Uses `account_id`-based flow (bank account, not wallet)

### Edge Function (`api-bills`)
- Processes bill payment against bank accounts (not wallet)
- Creates transaction + updates balance + records fee
- No idempotency, no intent pattern

## Gaps Identified
1. No provider directory (DB-driven categories/providers/products)
2. No dynamic payer fields (student name, ID, etc.)
3. No payment intent pattern (no idempotency)
4. No receipt screen with trace_id
5. No school fees support (campuses/locations)
6. No settlement framework for providers
7. Balance deduction not atomic
8. No structured payer_details capture

## What Must Remain Compatible
- Existing `api-bills` edge function (banking app uses it)
- Existing `transactions` table schema
- Existing `account_balances` table
- Existing routing: `/app/bills`, `/banking/payments/bills`
- Existing `useRecentBillPayments` hook
