
# Kang Open Banking -- Full Payment Gateway Upgrade Plan

## Overview

This plan upgrades the existing Kang Open Banking platform into a full payment gateway comparable to Flutterwave, adding a unified `/v1/gateway/*` namespace while preserving all existing Open Banking (AISP/PISP), Credit Scoring, Mobile Money, and other endpoints.

The work is organized into 6 implementation batches, each building on the previous one.

---

## Current State Summary

**What exists and works well:**
- 155+ edge functions covering AISP, PISP, OAuth, Mobile Money (Flutterwave), Card Payments (Stripe), Bank Transfers, Webhooks, Settlements, KYC/KYB, Virtual Cards, ISO 20022, SWIFT
- Comprehensive public OpenAPI spec (dynamic via `public-api-spec` edge function, ~1190 lines)
- Double-entry ledger system with journal posting
- Fee calculation engine with tiered/hybrid models
- Settlement calculation and processing
- Webhook delivery with HMAC signing and retry logic
- Idempotency key management
- Developer portal with 30+ pages, sandbox tools, API playground
- Admin portal with 36 management pages
- FI Portal with 29 institution management pages

**Key Gaps (what this upgrade adds):**
1. No unified "Gateway" charge/payout/refund object model -- payments are fragmented across `/v1/mobile-money/*`, `/v1/stripe/*`, `/v1/flutterwave/*`
2. No merchant onboarding flow separate from institution registration
3. No canonical Charge, Payout, Refund, Dispute objects with provider-agnostic status mapping
4. No `/v1/gateway/*` namespace for a Flutterwave-like developer experience
5. Missing gateway-specific developer docs (charges guide, payouts guide, etc.)
6. No sitemap.xml or robots.txt for SEO indexability
7. Static `openapi.json` is out of sync with dynamic `public-api-spec` edge function

---

## Batch 1: Database Schema -- Gateway Tables

Create new database tables for the unified payment gateway model. All existing tables remain untouched.

**New tables:**
- `gateway_merchants` -- Merchant entity (links to existing `institutions` or standalone). Fields: id, user_id, institution_id (nullable), business_name, status (draft/submitted/verified/active/suspended), kyb_status, environment, webhook_secret, created_at
- `gateway_charges` -- Canonical charge object. Fields: id, merchant_id, amount, currency, channel (mobile_money/card/bank_transfer), status (pending/processing/successful/failed/cancelled), provider (flutterwave/stripe), provider_ref, provider_raw (jsonb), customer_email, customer_phone, tx_ref, fee_amount, net_amount, metadata, idempotency_key, created_at, updated_at
- `gateway_payouts` -- Canonical payout. Fields: id, merchant_id, amount, currency, channel, status, provider, provider_ref, beneficiary_id, batch_id, narration, fee_amount, created_at
- `gateway_payout_batches` -- Batch payouts. Fields: id, merchant_id, total_amount, currency, status (pending/processing/completed/partial_failure), item_count, created_at
- `gateway_refunds` -- Canonical refund. Fields: id, charge_id, merchant_id, amount, currency, status, reason, provider_ref, created_at
- `gateway_disputes` -- Card disputes. Fields: id, charge_id, merchant_id, amount, currency, status, reason, evidence_due_by, provider_ref, created_at
- `gateway_settlements` -- Settlement records. Fields: id, merchant_id, amount, currency, status, period_start, period_end, charges_count, fees_total, payout_ref, settled_at
- `gateway_webhook_events` -- Outbound merchant webhook log. Fields: id, merchant_id, event_type, payload, status, attempts, next_retry_at, created_at

**RLS policies:** All tables use merchant_id scoping with admin bypass. Service role for webhook/settlement processing.

---

## Batch 2: Gateway Edge Functions (Core API)

Create new edge functions under the gateway namespace. Each maps to a `/v1/gateway/*` endpoint.

### Charges
- `gateway-create-charge` -- Routes to Flutterwave (MoMo) or Stripe (card) based on `channel` param. Creates canonical `gateway_charges` record, calls provider adapter, returns unified response.
- `gateway-get-charge` -- Fetch charge by ID with provider status sync
- `gateway-list-charges` -- List with filters (date, status, channel, customer)
- `gateway-cancel-charge` -- Cancel pending charge if supported

### Payouts
- `gateway-create-payout` -- Single payout via Flutterwave bank transfer or MoMo transfer
- `gateway-get-payout` -- Fetch payout status
- `gateway-list-payouts` -- List with filters
- `gateway-create-payout-batch` -- Bulk payout creation
- `gateway-get-payout-batch` -- Batch status with item breakdown

### Refunds
- `gateway-create-refund` -- Refund a charge (Stripe refund or MoMo compensation payout)
- `gateway-get-refund` -- Fetch refund status
- `gateway-list-refunds` -- List refunds

### Settlements
- `gateway-list-settlements` -- Merchant settlements
- `gateway-get-settlement` -- Settlement detail with line items

### Disputes
- `gateway-list-disputes` -- From Stripe webhook events
- `gateway-get-dispute` -- Dispute detail
- `gateway-submit-evidence` -- Upload dispute evidence

### Provider Webhooks (Inbound)
- `gateway-webhook-flutterwave` -- Verify hash, dedupe, update canonical charge/payout status, trigger outbound merchant webhooks
- `gateway-webhook-stripe` -- Verify Stripe signature, dedupe, handle charge/dispute/refund events

### Merchant Webhooks (Outbound)
- `gateway-deliver-webhook` -- Deliver signed events to merchant endpoints with retry

### Provider Adapter Pattern
Create a shared module `supabase/functions/_shared/gateway-adapters.ts` with:
- `createFlutterwaveCharge()`, `createStripeCharge()` -- provider-specific logic
- `mapFlutterwaveStatus()`, `mapStripeStatus()` -- normalize to canonical statuses
- Common interface for all provider operations

---

## Batch 3: OpenAPI Spec Update

Update the dynamic `public-api-spec` edge function to include all `/v1/gateway/*` paths with full request/response schemas.

**New schemas to add:**
- `GatewayCharge`, `GatewayPayout`, `GatewayPayoutBatch`, `GatewayRefund`, `GatewayDispute`, `GatewaySettlement`, `GatewayMerchant`

**New tag:** `Gateway` -- "Unified Payment Gateway (charges, payouts, refunds, settlements)"

**Also update `public/openapi.json`** to stay in sync as the static fallback.

Mark existing `/v1/mobile-money/*`, `/v1/stripe/*`, `/v1/flutterwave/*` endpoints with `x-deprecated: true` and `description` noting "Use /v1/gateway/* for new integrations."

---

## Batch 4: Developer Portal -- Gateway Documentation Pages

Create new developer portal pages for the gateway API:

- `src/pages/developer/GatewayQuickstart.tsx` -- Getting started with the Gateway API (auth, first charge, webhook setup)
- `src/pages/developer/GatewayChargesGuide.tsx` -- Charges reference (MoMo, Card, Bank Transfer channels)
- `src/pages/developer/GatewayPayoutsGuide.tsx` -- Single and batch payouts
- `src/pages/developer/GatewayRefundsGuide.tsx` -- Refund flows by channel
- `src/pages/developer/GatewaySettlementsGuide.tsx` -- Settlement schedules and reports
- `src/pages/developer/GatewayDisputesGuide.tsx` -- Card dispute management
- `src/pages/developer/GatewayWebhooksGuide.tsx` -- Event types, signature verification, retry policy

**Update navigation:** Add "Payment Gateway" section to developer sidebar with all new pages.

**Update `src/App.tsx`:** Register routes under `/developer/gateway/*`.

**Update `src/pages/Documentation.tsx`:** Add Gateway section to the main docs hub with links to all gateway guides.

---

## Batch 5: SEO and Public Indexability

- Create `public/sitemap.xml` listing all public documentation routes
- Create `public/robots.txt` allowing indexing of docs, blocking admin/fi-portal
- Add SEO meta tags to all new gateway documentation pages
- Ensure OpenAPI spec download links and Postman collection links are functional on the docs page

---

## Batch 6: End-to-End Testing and Verification

After all implementations:

1. **Database verification** -- Query all new gateway tables to confirm schema
2. **Edge function deployment** -- Deploy all new gateway functions
3. **API testing** -- Call each gateway endpoint via curl to verify:
   - Create charge (MoMo channel)
   - Create charge (card channel)  
   - List charges with filters
   - Create payout
   - Create refund
   - List settlements
4. **OpenAPI spec verification** -- Fetch `/functions/v1/public-api-spec` and verify all gateway paths are present
5. **Developer portal verification** -- Navigate to each new gateway doc page and verify rendering
6. **Backward compatibility** -- Verify existing `/v1/mobile-money/charge`, `/v1/stripe/payment-intent`, etc. still work

---

## Technical Details

### Canonical Status Mapping

```text
Provider Status          --> Gateway Status
------------------------------------------
Flutterwave: successful  --> successful
Flutterwave: pending     --> processing
Flutterwave: failed      --> failed
Stripe: succeeded        --> successful
Stripe: processing       --> processing
Stripe: requires_action  --> pending
Stripe: canceled         --> cancelled
```

### Gateway Charge Response Shape

```text
{
  "id": "chg_uuid",
  "merchant_id": "mch_uuid",
  "amount": 5000,
  "currency": "XAF",
  "channel": "mobile_money",
  "status": "processing",
  "provider": "flutterwave",
  "provider_ref": "FLW-1234",
  "fee_amount": 175,
  "net_amount": 4825,
  "customer": { "phone": "237677123456" },
  "tx_ref": "order_12345",
  "created_at": "2026-02-21T10:00:00Z"
}
```

### Webhook Event Types (Outbound to Merchants)

- `charge.successful`, `charge.failed`
- `payout.completed`, `payout.failed`
- `refund.completed`, `refund.failed`
- `dispute.created`, `dispute.won`, `dispute.lost`
- `settlement.paid`

### Files to Create (Summary)

**Edge Functions (15 new):**
- `supabase/functions/gateway-create-charge/index.ts`
- `supabase/functions/gateway-get-charge/index.ts`
- `supabase/functions/gateway-list-charges/index.ts`
- `supabase/functions/gateway-create-payout/index.ts`
- `supabase/functions/gateway-get-payout/index.ts`
- `supabase/functions/gateway-list-payouts/index.ts`
- `supabase/functions/gateway-create-payout-batch/index.ts`
- `supabase/functions/gateway-create-refund/index.ts`
- `supabase/functions/gateway-get-refund/index.ts`
- `supabase/functions/gateway-list-refunds/index.ts`
- `supabase/functions/gateway-list-settlements/index.ts`
- `supabase/functions/gateway-list-disputes/index.ts`
- `supabase/functions/gateway-webhook-flutterwave/index.ts`
- `supabase/functions/gateway-webhook-stripe/index.ts`
- `supabase/functions/gateway-deliver-webhook/index.ts`

**Shared Module:**
- `supabase/functions/_shared/gateway-adapters.ts`

**Developer Portal Pages (7 new):**
- `src/pages/developer/GatewayQuickstart.tsx`
- `src/pages/developer/GatewayChargesGuide.tsx`
- `src/pages/developer/GatewayPayoutsGuide.tsx`
- `src/pages/developer/GatewayRefundsGuide.tsx`
- `src/pages/developer/GatewaySettlementsGuide.tsx`
- `src/pages/developer/GatewayDisputesGuide.tsx`
- `src/pages/developer/GatewayWebhooksGuide.tsx`

**Public Assets:**
- `public/sitemap.xml`
- `public/robots.txt`

**Files to Edit:**
- `supabase/functions/public-api-spec/index.ts` (add gateway paths + schemas)
- `public/openapi.json` (sync with dynamic spec)
- `src/App.tsx` (register gateway doc routes)
- `src/pages/Documentation.tsx` (add gateway section)
- Developer sidebar navigation component
- `supabase/config.toml` (JWT settings for new functions)

### What is NOT Changed (Backward Compatibility)

- All existing `/v1/mobile-money/*`, `/v1/stripe/*`, `/v1/flutterwave/*`, `/v1/pisp/*`, `/v1/aisp/*` endpoints remain functional
- All existing database tables remain untouched
- All existing admin, FI portal, and developer portal pages remain functional
- Existing webhook infrastructure continues to work independently
