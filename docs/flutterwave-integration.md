# Flutterwave Integration Guide

> KOB uses Flutterwave as a payment rail for mobile money charges, bank transfers, and institutional settlements in the CEMAC region.

---

## Architecture

```
┌─────────────┐       ┌──────────────┐       ┌────────────────┐
│  TPP / App   │──────▶│  KOB Edge    │──────▶│  Flutterwave   │
│  (Frontend)  │       │  Functions   │       │  API v3        │
└─────────────┘       └──────┬───────┘       └───────┬────────┘
                             │                       │
                             ▼                       │
                      ┌──────────────┐               │
                      │  Supabase DB │◀──────────────┘
                      │  (Postgres)  │   (webhook callback)
                      └──────────────┘
```

### Edge Functions

| Function | Purpose |
|----------|---------|
| `facilitated-mobile-money-charge` | Initiate mobile money collection via Flutterwave |
| `flutterwave-bank-transfer` | Initiate bank transfer payout |
| `flutterwave-list-banks` | List supported banks |
| `flutterwave-verify-bank` | Verify bank account details |
| `flutterwave-transfer-webhook` | Receive and process Flutterwave webhooks |
| `mobile-money-verify` | Verify charge status and auto-credit accounts |

### Database Tables

| Table | Role |
|-------|------|
| `mobile_money_transactions` | Mobile money charge records |
| `bank_transfer_transactions` | Bank transfer payout records |
| `settlement_transactions` | Institutional settlement records |
| `webhook_inbox` | Webhook deduplication ledger |
| `security_audit_logs` | Audit trail for all webhook events |

---

## Webhook Processing

### Endpoint

```
POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/flutterwave-transfer-webhook
```

### Signature Verification

Every incoming webhook is verified using HMAC-SHA256:

1. Extract `verif-hash` header from the request
2. Compute HMAC-SHA256 of the raw JSON body using `FLUTTERWAVE_SECRET_KEY`
3. Compare computed hash with the header value
4. Reject with `401` if mismatch — **no state mutation occurs**

### Deduplication

Webhooks are deduplicated via the `webhook_inbox` table:

1. A unique key is generated: `flutterwave:{event}:{data.id|flw_ref|reference}`
2. Check `webhook_inbox` for existing record with `source=flutterwave` and matching `event_id`
3. If `is_processed = true` → return `200` immediately (idempotent replay)
4. If not found → insert new record with `is_processed = false`
5. Process the webhook
6. Mark `is_processed = true` on success

This prevents duplicate processing from Flutterwave's retry mechanism.

### Supported Events

| Event | Action |
|-------|--------|
| `transfer.completed` | Updates `bank_transfer_transactions` and optionally `settlement_transactions` |
| `charge.completed` | Updates `mobile_money_transactions`, triggers auto-credit for bank deposits |

### Status Mapping

| Flutterwave Status | KOB Status |
|--------------------|------------|
| `successful` / `success` | `completed` |
| `failed` | `failed` |
| Other | `pending` |

---

## Mobile Money Charge Flow

```bash
# 1. Initiate a charge
curl -X POST "${BASE_URL}/facilitated-mobile-money-charge" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+237670000000",
    "amount": 50000,
    "currency": "XAF",
    "email": "customer@example.com",
    "redirect_url": "https://myapp.com/payment/callback",
    "metadata": { "order_id": "ORD-001" }
  }'
```

**Response:**
```json
{
  "success": true,
  "transaction_ref": "KOB-MM-1708099200000-ABC123DEF",
  "transaction_id": "uuid-...",
  "flutterwave_link": "https://checkout.flutterwave.com/...",
  "kob_fee_amount": 1850,
  "net_amount": 48150
}
```

### Fee Calculation

- If institution has a custom `fee_structure`, it uses `calculate_transaction_fee` RPC
- Default fallback: **3.5% + 100 XAF**

---

## Bank Transfer Flow

```bash
curl -X POST "${BASE_URL}/flutterwave-bank-transfer" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "0012345678",
    "bank_code": "044",
    "amount": 100000,
    "currency": "XAF",
    "narration": "Salary payment",
    "beneficiary_name": "Jean Dupont"
  }'
```

---

## Bank Verification

```bash
# List banks
curl -X GET "${BASE_URL}/flutterwave-list-banks?country=CM" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"

# Verify account
curl -X POST "${BASE_URL}/flutterwave-verify-bank" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "0012345678",
    "bank_code": "044"
  }'
```

---

## Reconciliation

### Stuck Payments

Payments may get stuck in `pending` or `processing` if:
- Flutterwave webhook delivery fails
- Network timeout during webhook processing
- Signature verification fails on a legitimate webhook

### Resolution Steps

1. **Query stuck transactions:**
   ```sql
   SELECT * FROM mobile_money_transactions
   WHERE status IN ('pending', 'processing')
     AND created_at < NOW() - INTERVAL '2 hours';
   ```

2. **Check webhook_inbox for unprocessed entries:**
   ```sql
   SELECT * FROM webhook_inbox
   WHERE source = 'flutterwave'
     AND is_processed = false
     AND created_at < NOW() - INTERVAL '1 hour';
   ```

3. **Manual verification via Flutterwave API:**
   Call `mobile-money-verify` with the transaction reference to poll Flutterwave for the current status.

---

## Required Secrets

| Secret | Purpose |
|--------|---------|
| `FLUTTERWAVE_SECRET_KEY` | API authentication + webhook signature verification |
| `FLUTTERWAVE_PUBLIC_KEY` | Client-side payment initialisation |
| `FLUTTERWAVE_ENCRYPTION_KEY` | Card payment encryption |

---

## Security Considerations

- Webhook signature **must** be verified before any state mutation
- All webhook events are logged in `security_audit_logs`
- Deduplication prevents double-crediting on retried webhooks
- Fee calculations are server-side only — never trust client-provided fee amounts
- `FLUTTERWAVE_SECRET_KEY` is stored as a backend secret, never exposed to the frontend
