# Bank Transfer Instructions

When you create a charge with `channel: "bank_transfer"`, the KOB API returns a `next_action` block of type `bank_transfer_instructions` containing a virtual account number, a unique reference, and the amount to transfer. Display these to the customer; KOB confirms the transfer automatically and emits the `charge.successful` webhook.

## Example response

```json
{
  "id": "chg_btxxx",
  "channel": "bank_transfer",
  "amount": 100000,
  "currency": "XAF",
  "status": "pending",
  "next_action": {
    "type": "bank_transfer_instructions",
    "bank_name": "Mock Bank Cameroon",
    "account_number": "1234567890",
    "account_name": "KOB-COLLECT-MERCH123",
    "reference": "FLW-MOCK-REF-12345",
    "amount": 100000,
    "expires_at": "2026-04-22T10:00:00Z",
    "instructions": "Transfer the exact amount to the account above using the reference. Funds confirm within 1-5 minutes."
  }
}
```

## Flow

1. **Server** — `POST /v1/gateway/charges` with `channel: "bank_transfer"`.
2. **UI** — Display the `bank_name`, `account_number`, `reference`, and `amount` to the customer with a "copy" button next to each.
3. **Customer** — Initiates a bank transfer from their bank app or branch using the displayed reference.
4. **KOB** — Detects the inbound transfer, marks the charge `successful`, and posts the `charge.successful` webhook.
5. **Server (optional)** — `POST /v1/gateway/charges/{id}/verify` for an instant status check.

## Examples

### cURL

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge \
  -H "Authorization: Bearer sk_test_…" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: invoice_001" \
  -d '{ "amount": 100000, "currency": "XAF", "channel": "bank_transfer",
        "customer_email": "jane@example.com", "tx_ref": "invoice_001" }'
```

### Node.js

```js
const r = await fetch("https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-create-charge", {
  method: "POST",
  headers: { Authorization: `Bearer ${SK_TEST}`, "Content-Type": "application/json", "Idempotency-Key": "invoice_001" },
  body: JSON.stringify({ amount: 100000, currency: "XAF", channel: "bank_transfer", tx_ref: "invoice_001" }),
}).then(r => r.json());

console.log("Show to customer:", r.next_action);
```

### Python

```python
import requests
r = requests.post(URL, headers={"Authorization": f"Bearer {SK_TEST}"}, json={
  "amount": 100000, "currency": "XAF", "channel": "bank_transfer", "tx_ref": "invoice_001"
}).json()
print(r["next_action"]["account_number"], r["next_action"]["reference"])
```

### PHP / Java / Go

Same shape as cURL — POST `/v1/gateway/charges`, read `response.next_action.account_number` and `response.next_action.reference`.

## Notes

- Virtual accounts expire — see `next_action.expires_at`. Generate a fresh charge if the customer waits too long.
- The reference is **mandatory** for reconciliation. A transfer without the correct reference cannot be auto-matched.
- For KOB-partner banks (Afriland, BICEC, UBA CM, Ecobank CM, SGC) settlement is near-instant. For non-partner banks, allow up to 30 minutes.
