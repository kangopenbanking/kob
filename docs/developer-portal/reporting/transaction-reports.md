# Transaction Reports

## Overview

Generate transaction reports for reconciliation, accounting, and compliance purposes.

## List Transactions

```bash
curl "https://api.kangopenbanking.com/v1/gateway/reports/transactions?merchant_id=merch_uuid&from=2026-03-01&to=2026-03-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Export to CSV

```bash
curl "https://api.kangopenbanking.com/v1/gateway/export/transactions?merchant_id=merch_uuid&format=csv&from=2026-03-01&to=2026-03-31" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o transactions.csv
```

### CSV Fields

| Column | Description |
|--------|-------------|
| `id` | Transaction ID |
| `tx_ref` | Your reference |
| `amount` | Transaction amount |
| `currency` | Currency code |
| `channel` | Payment channel |
| `status` | Final status |
| `fee_amount` | Platform fee |
| `net_amount` | Amount after fees |
| `customer_email` | Customer email |
| `created_at` | Timestamp |

## Fee Reports

```bash
curl "https://api.kangopenbanking.com/v1/gateway/reports/fees?merchant_id=merch_uuid&from=2026-03-01&to=2026-03-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Returns a breakdown of fees by channel and transaction type.
