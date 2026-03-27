

# Fix: Remittance Backend Completion Pipeline

## Problem

The remittance system has a **critical gap**: after a transfer is created (`status: "created"` or `"pending"`), there is **no backend logic** to:
1. Initiate the actual payout via Flutterwave MoMo, PayPal, or KOB Wallet
2. Transition the remittance through `in_transit` → `delivered`
3. Handle webhook callbacks from providers to finalize the transfer

The `sendRemittance` function creates the record and stops. The existing webhook handlers (`gateway-webhook-flutterwave`, `gateway-webhook-paypal`) handle `gateway_charges` and `gateway_payouts` but have **no awareness of the `remittances` table**.

## Architecture

```text
Current flow (broken):
  Client → remittance-outbound(send) → INSERT remittance (status: pending) → STOP

Required flow:
  Client → remittance-outbound(send) → INSERT remittance (pending)
                                      → Auto-execute payout rail
                                      → Status: in_transit
                                      → Provider webhook → Status: delivered ✅
                                      → Client polls track → sees delivered → celebration 🎉
```

## Plan

### 1. Add `remittance-fulfill` edge function (new)

A new function that executes the actual payout based on delivery method. Called inline by `sendRemittance` after compliance clears (for low-risk), or by admin compliance approval.

Actions:
- **For Mobile Money (Flutterwave)**: Call Flutterwave transfer API to send funds to recipient phone
- **For PayPal**: Call PayPal payout API to send funds to recipient email
- **For Wallet Balance (KOB internal)**: Debit sender wallet, credit receiver wallet atomically
- **For Bank Transfer**: Call Flutterwave bank transfer API

Each rail:
1. Creates a `gateway_payouts` record linking `remittance_id` in metadata
2. Updates remittance status to `in_transit`
3. Logs `payout_initiated` event in `remittance_events`
4. Returns immediately (webhook handles finality)

For **Wallet Balance**: completes synchronously — sets status to `delivered` immediately.

### 2. Update `remittance-outbound` `sendRemittance` (additive)

After the compliance auto-approve block (line ~264-275), add a call to the fulfillment logic:
- If `compliance_status === "cleared"`, invoke `fulfillRemittance()` inline
- This triggers the payout rail and moves status to `in_transit`

After admin compliance approval (`complianceDecision` with `approved`), also trigger fulfillment.

### 3. Update `gateway-webhook-flutterwave` (additive)

Add a block after existing payout processing (~line 158-224) to check if the payout's metadata contains a `remittance_id`. If so:
- Update `remittances.status` to `delivered` (on success) or `failed` (on failure)
- Insert `remittance_events` entry (`transfer_delivered` or `transfer_failed`)
- Send notification + email to sender
- Fire outbound client webhook via `remittance-client-webhooks`

### 4. Update `gateway-webhook-paypal` (additive)

Same pattern: after payout status update, check for `remittance_id` in payout metadata and update remittance status accordingly.

### 5. Update frontend polling in `CustomerSendMoney.tsx`

After `sendMut.onSuccess`, add a polling interval that calls `track` every 5 seconds until status reaches `delivered` or `failed`. Update the success screen to show real-time status progression:
- `pending` → "Processing..."
- `in_transit` → "Funds on the way..."
- `delivered` → Confetti celebration

## Files Changed

| File | Change Type |
|---|---|
| `supabase/functions/remittance-fulfill/index.ts` | **NEW** — Payout execution engine |
| `supabase/functions/remittance-outbound/index.ts` | **ADDITIVE** — Call fulfillment after compliance clear |
| `supabase/functions/gateway-webhook-flutterwave/index.ts` | **ADDITIVE** — Remittance status sync on payout completion |
| `supabase/functions/gateway-webhook-paypal/index.ts` | **ADDITIVE** — Remittance status sync on payout completion |
| `src/pages/customer-app/CustomerSendMoney.tsx` | **ADDITIVE** — Status polling + animated progress |

## No Database Changes Required

The existing `remittances`, `remittance_events`, `gateway_payouts`, and `remittance_payin_intents` tables already support all needed fields. The `remittances.status` column already accepts `in_transit` and `delivered` values.

