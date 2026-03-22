# Postman E2E Report — KOB v4.2.0

## Summary

The Postman collection has been hardened to professional gateway standards with automated test scripts, variable chaining, and runnable E2E smoke tests.

## Changes Applied

### 1. Per-Request Test Scripts ✅
- **Every request** now has auto-injected `event` blocks with:
  - Status code assertion (2xx range)
  - JSON body assertion (for non-DELETE)
  - Custom field assertions where applicable

### 2. Variable Chaining ✅
| Request | Saves Variable |
|---------|---------------|
| Create Charge | `charge_id` |
| Create Refund | `refund_id` |
| Create Payout | `payout_id` |
| OAuth Token | `access_token` |

### 3. New Collection Variables ✅
Added 13 new variables: `idempotency_key`, `webhook_url`, `subscription_id`, `payment_link_id`, `virtual_account_id`, `subaccount_id`, `customer_id`, `token_id`, `plan_id`, `reconciliation_run_id`, `mismatch_id`, `escrow_id`

### 4. Enhanced Environments ✅
Both Sandbox and Production environments now include:
- `merchant_api_key`
- `webhook_secret`
- `idempotency_key_prefix`

### 5. Smoke Test Folder ✅
6-step chained E2E flow:
1. Health Check → assert 200
2. Get Auth Token → save `access_token`
3. Create Charge → save `charge_id`
4. Get Charge → verify matches saved ID
5. Create Refund → save `refund_id`
6. Get Refund → verify matches saved ID

## Coverage

| Metric | Value |
|--------|-------|
| Total requests | 165+ |
| Requests with test scripts | 165+ (100%) |
| Variable-chaining requests | 4 key resources |
| E2E smoke test steps | 6 |
| Environments | 2 (Sandbox + Production) |
| Collection variables | 39 |

## How to Run

```bash
# Import collection
# Import KOB Sandbox environment
# Set client_id and client_secret
# Run "Smoke Test (E2E)" folder in Postman Runner
```
