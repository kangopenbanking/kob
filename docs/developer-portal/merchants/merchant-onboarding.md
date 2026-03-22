# Merchant Onboarding

## Overview

Merchants go through a structured onboarding lifecycle to accept payments via KOB.

## Lifecycle

```
Register → Submit KYB → Under Review → Approved → Active
                                      → Rejected (resubmit)
```

## Step 1: Register

Create a merchant account via the API or Merchant Portal:

```bash
curl -X POST https://api.kangopenbanking.com/functions/v1/gateway-create-charge \
  -H "Authorization: Bearer <user_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "business_name": "Cafe Douala",
    "business_type": "restaurant",
    "country": "CM",
    "phone": "+237650000000"
  }'
```

## Step 2: Submit KYB

Upload required documents:

| Document | Required |
|---|---|
| Business registration certificate | ✅ |
| Government-issued ID (owner) | ✅ |
| Proof of address | ✅ |
| Tax identification number | Recommended |

## Step 3: Admin Review

KOB admin reviews your submission. Typical turnaround: 1-3 business days.

## Step 4: Get API Keys

After approval:
1. Go to **Merchant Portal → API Keys**
2. Generate sandbox keys for testing
3. Generate production keys when ready to go live

## Step 5: Configure Webhooks

Register your webhook endpoint to receive payment notifications:
1. Go to **Merchant Portal → Webhooks**
2. Add your HTTPS endpoint URL
3. Select events to subscribe to
4. Copy the signing secret for verification

## Step 6: Configure Settlement Account

Set up where your funds are settled:
1. Go to **Merchant Portal → Settlement**
2. Add your bank account (Cameroon banks supported)
3. Choose settlement frequency (daily/weekly/monthly)

## Merchant States

| State | Meaning |
|---|---|
| `pending_kyb` | Awaiting document submission |
| `under_review` | Documents being reviewed |
| `active` | Approved, can process payments |
| `suspended` | Temporarily disabled |
| `deactivated` | Permanently disabled |
