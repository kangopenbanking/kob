# Sandbox Overview

## Getting Started

The KOB sandbox lets you test all API functionality without real money.

## Sandbox vs Production

| Feature | Sandbox | Production |
|---|---|---|
| Base URL | `https://sandbox-api.kangopenbanking.com/v1` | `https://api.kangopenbanking.com/v1` |
| API Key prefix | `sk_test_*` / `pk_test_*` / `sbx_*` | `sk_live_*` / `pk_live_*` |
| Real money movement | No | Yes |
| Provider calls | Mocked (deterministic test numbers/cards) | Real Stripe / Flutterwave / PayPal / MTN / Orange |
| Webhooks | Simulated; deterministic event ordering | Real provider signatures, real timing jitter |
| Rate limits | Same envelope (per-key) | Same envelope (per-key) |
| KYB enforcement | Bypassed for test merchants | Strict — production keys gated on KYB approval |
| Settlement | Instant book to test wallet | Real settlement windows (T+1 / T+2 per channel) |
| Persistence | Sandbox data isolated; resettable from Sandbox Console | Permanent, audited |

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
