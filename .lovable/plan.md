

# Plan: Add PayPal as a Remittance Partner with Automated Corridors

## What We'll Do

### 1. Seed PayPal as a Remittance Partner (Database Insert)

Insert a new partner into `remittance_partners`:

| Field | Value |
|---|---|
| name | `paypal` |
| display_name | PayPal |
| status | `active` |
| api_config | `{"adapter": "gateway-create-paypal-payout", "payout_method": "paypal_email"}` |

### 2. Seed PayPal Corridors (Database Insert)

Insert corridors into `remittance_corridors` linked to the PayPal partner:

| Route | FX Rate | Fee | Delivery | Methods |
|---|---|---|---|---|
| US → CM | 605.50 USD/XAF | 2.5% + $4.99 | ~30 min | `paypal_email` |
| FR → CM | 655.957 EUR/XAF | 2.0% + €3.99 | ~30 min | `paypal_email` |
| GB → CM | 765.50 GBP/XAF | 2.0% + £3.49 | ~30 min | `paypal_email` |
| DE → CM | 655.957 EUR/XAF | 2.0% + €3.99 | ~30 min | `paypal_email` |
| CA → CM | 445.20 CAD/XAF | 2.5% + C$4.99 | ~45 min | `paypal_email` |

### 3. Update UI Constants (2 files)

**`src/pages/admin/RemittancePartners.tsx`**: Add `paypal: "bg-[#0070BA]"` to `PARTNER_COLORS`.

**`src/components/admin/remittance/CorridorQuickSetup.tsx`**: Add `paypal` entry to `PARTNER_CORRIDOR_TEMPLATES` so PayPal corridors appear in the Quick Setup wizard.

### 4. Navigate and Verify

Browse to `/admin/remittance-partners` to confirm PayPal appears as a partner card with its corridors in the table.

## Technical Detail

- **No schema changes** — uses existing `remittance_partners` and `remittance_corridors` tables
- **No existing data modified** — additive inserts only
- **Wiring**: The `api_config` metadata on the partner references `gateway-create-paypal-payout`, which already handles PayPal batch payouts via email/phone/ID
- **Files modified (2)**: `RemittancePartners.tsx` (1 line), `CorridorQuickSetup.tsx` (~8 lines)

