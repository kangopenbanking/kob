

# Hero Send Form — Full Payment Integration by Destination Type + E2E Audit

## Summary

Transform the hero section's static calculator into a fully functional multi-destination send form that adapts its fields based on the selected delivery method (KOB Wallet, Bank Account, Bills & Fees). Desktop users can complete the entire flow — from amount entry through quote to confirmation — without leaving the `/remittance` page. Also fix identified gaps across the page.

## Current State

The `SendForm` in `RemittanceLanding.tsx` is a **demo calculator only**: it shows exchange rates and a "Send money now" button that links to `/app/send-money`. The delivery method buttons (wallet/bank/bills) change local state but produce no form changes or actual API calls.

## Implementation Plan

### 1. Rebuild SendForm with Destination-Specific Fields

Transform `SendForm` into a multi-step inline component with 3 states: **calculate → details → confirm/success**.

**When "KOB Wallet" is selected:**
- Show: Recipient phone (`+237` prefix), Recipient name
- API: `remittance-outbound` → `get_quote` then `send` with `delivery_method: "mobile_wallet"`

**When "Bank Account" is selected:**
- Show: Bank selector dropdown (reuse the priority logic from `BankSelector.tsx` — KOB Partner banks first, then Flutterwave banks, then CM fallback), Account number / RIB input, Recipient name
- API: `remittance-outbound` → `get_quote` then `send` with `delivery_method: "bank_transfer"`

**When "Bills & Fees" is selected:**
- Show: Purpose selector (School Fees, Utilities, Medical, Other), Bill reference/invoice number, Recipient name
- API: `remittance-outbound` → `get_quote` then `send` with `delivery_method: "bill_payment"` and purpose metadata

### 2. Add Inline Quote + Confirm Steps

After user fills details and clicks "Get Quote":
- Call `remittance-outbound` with `action: "get_quote"`
- Display quote breakdown inline (fee, rate, receiver gets, delivery estimate)
- "Confirm & Send" button calls `action: "send"`
- On success: show inline success state with reference number and "Send Another" reset button
- On error: show toast with error message
- Auth check: if user not logged in, redirect to `/app/send-money` with pre-filled params via URL query string

### 3. Form State Machine

```text
CALCULATE → (click "Get Quote") → QUOTE_REVIEW → (click "Send") → PROCESSING → SUCCESS
    ↑                                    |                                         |
    └────────────── (Edit) ──────────────┘              (Send Another) ────────────┘
```

### 4. E2E Gaps Identified & Fixes

| # | Gap | Fix |
|---|---|---|
| 1 | Hero send button is just a Link to `/app/send-money` — no actual form submission | Replace with functional inline flow |
| 2 | Delivery method buttons are cosmetic — no field changes | Add conditional form fields per destination |
| 3 | No auth check before sending | Check session; if not logged in, redirect to `/app/send-money` with query params |
| 4 | Bank selector not integrated — just a phone field regardless of destination | Add bank dropdown for "Bank Account" mode |
| 5 | "API Documentation" button in RaaS section links to `/developer` — correct, no fix needed | — |
| 6 | Corridor cards in "Never Pay Hidden Fee" section use hardcoded data, not admin rates | Wire to `useAdminRates` hook already in use |
| 7 | No loading/disabled state on send button during API calls | Add loading spinner and disabled state |

### 5. Files to Modify

| File | Action |
|---|---|
| `src/pages/RemittanceLanding.tsx` | Rebuild `SendForm` component with multi-step flow, destination-specific fields, `remittance-outbound` API integration, auth check, inline quote/confirm/success states |

No new edge functions or migrations needed — all APIs (`remittance-outbound` actions: `get_corridors`, `get_quote`, `send`) already exist and are production-ready.

### Technical Notes

- The form fetches corridors on mount via `remittance-outbound` `get_corridors` to validate available routes
- Bank list for "Bank Account" mode: fetch from `flutterwave-list-banks` + `institutions` table (same pattern as `BankSelector.tsx`)
- For unauthenticated users: the "Send money now" button redirects to sign-in → `/app/send-money` with `?amount=X&currency=EUR&dest=wallet` pre-fill
- All form inputs validated client-side before API call (amount > 0, phone format, bank selection required)

