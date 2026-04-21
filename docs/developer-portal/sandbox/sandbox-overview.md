# Sandbox Overview

## Getting Started

The KOB sandbox lets you test all API functionality without real money.

## Sandbox vs Production

| Feature | Sandbox | Production |
|---|---|---|
| API Key prefix | `sk_test_*` (secret) / `pk_test_*` (publishable) | `sk_live_*` (secret) / `pk_live_*` (publishable) |
| Real money | ❌ | ✅ |
| Webhooks | ✅ Simulated | ✅ Real |
| Rate limits | Same | Same |
| Base URL | Same | Same |

## Test Data

### Mobile Money (Cameroon)
| Phone | Provider | Result |
|---|---|---|
| `237650000000` | MTN MoMo | ✅ Success |
| `237650000001` | MTN MoMo | ❌ Insufficient funds |
| `237690000000` | Orange Money | ✅ Success |
| `237690000001` | Orange Money | ❌ Failed |

### Card Payments
| Card Number | Result |
|---|---|
| `4242 4242 4242 4242` | ✅ Success |
| `4000 0000 0000 0002` | ❌ Declined |
| `4000 0000 0000 9995` | ❌ Insufficient funds |

Use any future expiry date and any 3-digit CVC.

### PayPal
Use PayPal sandbox accounts from your PayPal developer dashboard.

## Webhook Testing

Test webhook delivery without real transactions:

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-webhook-endpoints \
  -H "Authorization: Bearer sk_test_xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "test",
    "endpoint_id": "wh_xxxx",
    "event_type": "charge.successful"
  }'
```

## Data Generator

Generate realistic sandbox data for testing:
- Visit **Developer Portal → Sandbox → Data Generator**
- Create test merchants, charges, payouts, and settlements
