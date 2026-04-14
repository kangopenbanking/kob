# Test Cards & Mobile Money

## Sandbox Test Data

All sandbox requests should use the sandbox environment. Test data does not affect production.

## Mobile Money Test Numbers

| Provider | Phone Number | Behavior |
|----------|-------------|----------|
| MTN | `237650000000` | Always succeeds |
| MTN | `237650000001` | Always fails (insufficient funds) |
| MTN | `237650000002` | Timeout (30s delay) |
| Orange | `237690000000` | Always succeeds |
| Orange | `237690000001` | Always fails |

## Card Test Numbers

| Card Number | Brand | Behavior |
|-------------|-------|----------|
| `4242 4242 4242 4242` | Visa | Succeeds |
| `5555 5555 5555 4444` | Mastercard | Succeeds |
| `4000 0000 0000 0002` | Visa | Declined |
| `4000 0000 0000 9995` | Visa | Insufficient funds |
| `4000 0025 0000 3155` | Visa | 3D Secure required |

**Expiry**: Any future date (e.g., `12/30`)
**CVC**: Any 3 digits (e.g., `123`)

## Bank Transfer Test Accounts

| Bank Code | Account Number | Behavior |
|-----------|---------------|----------|
| `SGCM` | `1234567890` | Succeeds |
| `SGCM` | `0000000001` | Fails |

## PayPal Test Accounts

| Email | Behavior |
|-------|----------|
| `sb-buyer@personal.example.com` | Succeeds |
| `sb-fail@personal.example.com` | Fails |

## Sandbox Webhooks

Test webhook delivery using the sandbox webhook trigger:

```bash
curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants/webhooks?merchant_id=merch_uuid&webhook_id=wh_uuid&action=test" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This sends a test `charge.successful` event to your registered webhook URL.

## Generate Test Data

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/sandbox/data/generate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This creates sample accounts, transactions, and balances for testing AISP flows.
