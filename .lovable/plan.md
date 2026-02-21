

# KOB Payment Gateway -- Remaining Gaps vs Flutterwave (Round 2)

The previous round closed 6 major gaps. This audit identifies **9 remaining gaps** -- a mix of missing CRUD endpoints for the new tables, missing frontend pages, and Flutterwave features not yet addressed.

---

## Gap 1: Missing CRUD Endpoints for New Tables

Several new tables were created but only partial endpoint coverage was built. Flutterwave exposes full CRUD on all resources.

| Resource | Missing Endpoints |
|---|---|
| Payment Links | `gateway-update-payment-link` (update title/amount/status/expiry), `gateway-delete-payment-link` |
| Payment Plans | `gateway-get-payment-plan`, `gateway-list-payment-plans`, `gateway-update-payment-plan` |
| Subscriptions | `gateway-get-subscription`, `gateway-list-subscriptions` |
| Subaccounts | `gateway-get-subaccount`, `gateway-update-subaccount`, `gateway-delete-subaccount` |
| Customers | `gateway-list-customers`, `gateway-get-customer`, `gateway-update-customer` |
| Customer Tokens | `gateway-list-customer-tokens`, `gateway-revoke-customer-token` |

**Total: 14 new edge functions**

---

## Gap 2: Hosted Checkout Page (`/pay/:slug`)

The plan called for a hosted checkout frontend route but it was never built. The docs reference `/pay/:slug` but the route doesn't exist in `App.tsx`.

**What's needed:**
- New page component `src/pages/PaymentCheckout.tsx`
- Route in `App.tsx`: `/pay/:slug`
- Fetches payment link details via `gateway-get-payment-link`
- Renders a branded payment form (amount, phone/email, channel selector)
- Submits via `gateway-create-charge` with `payment_link_id`
- Shows success/failure state and optional redirect

---

## Gap 3: Gateway-Level Exchange Rate Endpoint

The plan specified a `gateway-get-exchange-rate` endpoint under the `/v1/gateway/` namespace, but it was never created. The existing `exchange-rate-get` function exists for banking but is not exposed under the gateway namespace. Flutterwave has a dedicated `/rates` endpoint.

**What's needed:**
- New `gateway-get-exchange-rate` edge function (can proxy to `exchange-rate-get` logic or the Frankfurter API directly)
- Register in OpenAPI spec under Payment Gateway tag

---

## Gap 4: Merchant Onboarding Dashboard for New Features

The FI portal Staff page (current route) and the merchant dashboard need UI sections for managing:
- Payment Links (list, create, view details)
- Subscriptions & Plans (list plans, view subscribers)
- Subaccounts (list, create)
- Customers & Tokens (list saved customers)

**What's needed:**
- Dashboard tabs/pages in the merchant gateway section for each new resource

---

## Gap 5: Webhook Events for New Lifecycle Events

The webhook system currently fires events for `charge.successful`, `charge.failed`, `payout.completed`, `payout.failed`, `refund.completed`. Flutterwave also fires:
- `subscription.created`, `subscription.cancelled`, `subscription.charge.successful`, `subscription.charge.failed`
- `payment_link.completed`

**What's needed:**
- Add webhook event insertion in `gateway-create-subscription`, `gateway-cancel-subscription`, `gateway-subscription-charge-cron`
- Add payment link completion event in the charge webhook handler when `payment_link_id` is present

---

## Gap 6: `save_token` Support in `gateway-create-charge`

The plan specified that `gateway-create-charge` should accept `save_token: true` to automatically tokenize a customer's payment method after a successful charge. This was not implemented.

**What's needed:**
- Accept `save_token` and `customer_id` in `gateway-create-charge` body
- After successful provider response, extract token data from provider and insert into `gateway_customer_tokens`

---

## Gap 7: OpenAPI Spec & Postman Collection Updates

The 14 new endpoints from Gap 1, plus the exchange rate endpoint, need to be added to:
- `public/openapi.json`
- `supabase/functions/public-api-spec/index.ts`
- `supabase/functions/postman-collection/index.ts`

---

## Gap 8: Apple Pay / Google Pay / USSD Channels

Flutterwave supports Apple Pay, Google Pay, and USSD as payment channels. KOB currently only supports `mobile_money`, `card`, and `bank_transfer`.

**What's needed:**
- Extend `gateway-create-charge` channel enum to include `apple_pay`, `google_pay`, `ussd`
- Add adapter functions in `gateway-adapters.ts` (these would route through Flutterwave's orchestrator API)
- Update fee calculation for new channels

---

## Gap 9: Transfer Retry / Requeue for Failed Payouts

Flutterwave allows merchants to retry failed transfers. KOB has no retry mechanism for payouts.

**What's needed:**
- `gateway-retry-payout` edge function that re-submits a failed payout to the provider
- Status transition validation (only `failed` payouts can be retried)

---

## Priority Order

1. **Missing CRUD Endpoints (Gap 1)** -- API completeness, highest impact
2. **Hosted Checkout Page (Gap 2)** -- promised in docs, user-facing
3. **save_token in create-charge (Gap 6)** -- enables tokenization flow
4. **Webhook Events for New Lifecycles (Gap 5)** -- production reliability
5. **Gateway Exchange Rate Endpoint (Gap 3)** -- API completeness
6. **OpenAPI / Postman Updates (Gap 7)** -- developer experience
7. **Payout Retry (Gap 9)** -- operational feature
8. **Merchant Dashboard UI (Gap 4)** -- admin experience
9. **Apple Pay / Google Pay / USSD (Gap 8)** -- advanced channels

---

## Technical Summary

| Category | Count |
|---|---|
| New edge functions | 16 |
| Modified edge functions | 3 |
| New frontend pages | 2 |
| Modified frontend files | 3 |
| Modified docs/specs | 3 |

### New Edge Functions (16)
1. `gateway-update-payment-link`
2. `gateway-delete-payment-link`
3. `gateway-get-payment-plan`
4. `gateway-list-payment-plans`
5. `gateway-update-payment-plan`
6. `gateway-get-subscription`
7. `gateway-list-subscriptions`
8. `gateway-get-subaccount`
9. `gateway-update-subaccount`
10. `gateway-delete-subaccount`
11. `gateway-list-customers`
12. `gateway-get-customer`
13. `gateway-update-customer`
14. `gateway-list-customer-tokens`
15. `gateway-revoke-customer-token`
16. `gateway-retry-payout`

### Modified Edge Functions (3)
- `gateway-create-charge` -- add `save_token` + `customer_id` support, extend channel enum
- `gateway-subscription-charge-cron` -- add webhook events for subscription charges
- `gateway-cancel-subscription` -- add webhook event

### New Frontend
- `src/pages/PaymentCheckout.tsx` -- hosted checkout for `/pay/:slug`
- Route registration in `App.tsx`

### Spec Updates
- `public/openapi.json` -- add all new endpoints
- `supabase/functions/public-api-spec/index.ts` -- add paths
- `supabase/functions/postman-collection/index.ts` -- add requests

