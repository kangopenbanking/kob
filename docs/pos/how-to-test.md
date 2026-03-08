# POS E2E Testing Guide

## Running Tests

Edge function tests use Deno and test against the live Supabase project.

### Prerequisites
- `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- All POS edge functions deployed

### Test File
`supabase/functions/pos-inventory-sync/index.test.ts`

### What's Tested
| Test | Description |
|------|-------------|
| A | Unauthenticated access to catalog/inventory/orders/refunds returns 401 |
| B | Pay order without idempotency key returns error |
| C | Submit order without auth returns 401 |
| D | Finalize payment with invalid charge returns error |
| E | Woo connector without auth returns 401 |
| F | Woo webhook without merchant header returns 400 |
| G | Inventory sync with no integrations returns success |
| H | Manage locations without auth returns 401 |

### Full Flow Testing (Manual)
For full E2E flow (connect→import→sell→pay→refund→sync), you need:
1. A WooCommerce sandbox store with valid REST API keys
2. An authenticated merchant user in KOB
3. A Flutterwave/Stripe sandbox for payment simulation

Steps:
1. Connect Woo store via `pos-woo-connector` with `action: connect`
2. Import products via `pos-woo-connector` with `action: import_products`
3. Create POS order via `pos-orders`
4. Submit order via `pos-submit-order`
5. Pay order via `pos-pay-order` with `Idempotency-Key`
6. Simulate webhook via `pos-finalize-payment`
7. Verify inventory decremented
8. Refund via `pos-refunds`
9. Verify inventory restocked
10. Trigger sync via `pos-inventory-sync`
