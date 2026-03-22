# Reconciliation

## Overview

KOB provides automated reconciliation between internal records and payment provider reports. The system detects mismatches in amounts, statuses, or missing transactions.

## Run Reconciliation

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/reconciliation \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: recon_march_2026" \
  -d '{
    "merchant_id": "merch_uuid",
    "provider": "flutterwave",
    "period_start": "2026-03-01T00:00:00Z",
    "period_end": "2026-03-31T23:59:59Z"
  }'
```

## List Mismatches

```bash
curl "https://api.kangopenbanking.com/v1/gateway/reconciliation/{run_id}/mismatches?limit=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mismatch Types

| Type | Description |
|------|-------------|
| `amount_mismatch` | Amount differs between KOB and provider |
| `status_mismatch` | Status differs |
| `missing_in_kob` | Transaction in provider but not in KOB |
| `missing_in_provider` | Transaction in KOB but not in provider |

## Resolve a Mismatch

```bash
curl -X POST https://api.kangopenbanking.com/v1/gateway/reconciliation/{run_id}/mismatches/{mismatch_id}/resolve \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "accepted",
    "resolution_notes": "Verified with provider bank statement"
  }'
```
