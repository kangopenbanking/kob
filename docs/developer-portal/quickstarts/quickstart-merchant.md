# Quickstart: Merchants

## 1. Create a Merchant Account

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: merchant_setup_001" \
  -d '{
    "business_name": "Ma Boutique Douala",
    "business_email": "contact@maboutique.cm",
    "business_phone": "+237677123456"
  }'
```

## 2. Submit KYB (Know Your Business)

```bash
curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants/kyb?merchant_id=merch_uuid&action=submit" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "registration_number": "RC/DLA/2026/B/001",
    "tax_id": "TAX-CM-12345"
  }'
```

## 3. Get API Keys

Once your KYB is approved:

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants/api-keys \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "merch_uuid",
    "environment": "sandbox",
    "label": "Primary Sandbox Key"
  }'
```

> ⚠️ Save the `secret` from the response — it's shown only once.

## 4. Configure Webhooks

```bash
curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/merchants/webhooks?merchant_id=merch_uuid" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourapp.com/webhooks/kob",
    "events": ["charge.successful", "payout.completed"]
  }'
```

## 5. Accept Your First Payment

```bash
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway/charges \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: first_payment_001" \
  -d '{
    "merchant_id": "merch_uuid",
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "237677123456",
    "tx_ref": "order_001"
  }'
```

## Next Steps

- [Configure settlement accounts](../merchants/merchant-onboarding.md)
- [Set up webhook verification](../webhooks/merchant-webhooks.md)
- [Test in sandbox](../sandbox/sandbox-overview.md)
