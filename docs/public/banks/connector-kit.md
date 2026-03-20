# Bank Connector Kit — Overview

The KOB Bank Connector Kit enables financial institutions to connect to the KOB platform using **three integration modes**. Banks choose the mode that best fits their infrastructure.

## Integration Modes

| Mode | Direction | Description | When to Use |
|---|---|---|---|
| **File (CSV/pain.001)** | Bi-directional | Upload CSV files, download payment instruction files | Bank has no API; legacy core banking |
| **Database Connector** | KOB → Bank DB | KOB polls the bank's read-only database replica on a schedule | Bank has a DB replica or CDC feed available |
| **Message Queue (Real-Time)** | Bi-directional | Events pushed/received via webhook, Supabase Realtime, or SSE | Bank has API capability and needs real-time sync |
| **HTTPS Push** | Bank → KOB | Bank pushes data to KOB ingestion endpoints | Bank has outbound API capability |

---

## 1. File Connector (CSV / ISO 20022)

### Workflow
1. Download CSV template for data type (accounts, transactions, balances, beneficiaries)
2. Fill in data from core banking system
3. Upload to KOB — automatic validation, deduplication (SHA-256), and ingestion
4. For outbound: generate batch payment instructions (CSV or pain.001 XML)
5. Upload status file after processing in core banking system

### Edge Function
`bank-file-connector` — 18 actions including upload, mapping, ingestion, batch, status, sandbox

---

## 2. Database Connector

### Workflow
1. Register a DB connection (PostgreSQL, MySQL, MSSQL, Oracle, MongoDB)
2. Provide read-only credentials and polling queries
3. KOB polls on your configured interval using watermark-based incremental sync
4. Data flows into `bank_sourced_*` tables automatically

### Polling Queries
Use `:watermark` placeholder for incremental sync:
```sql
SELECT id AS external_account_id, type AS account_type, account_number AS identification_value,
       currency, status, updated_at
FROM core.accounts
WHERE updated_at > :watermark
```

### Edge Function
`bank-db-connector` — Actions: register_connection, list_connections, update_connection, test_connection, trigger_sync, list_sync_runs, poll_due, sandbox_seed_db_connector

### Supported Databases
| DB Type | Default Port | Status |
|---|---|---|
| PostgreSQL | 5432 | ✅ Supported |
| MySQL | 3306 | ✅ Supported |
| MSSQL | 1433 | ✅ Supported |
| Oracle | 1521 | ✅ Supported |
| MongoDB | 27017 | ✅ Supported |

---

## 3. Message Queue Connector (Real-Time)

### Channel Types
| Type | Description | Direction |
|---|---|---|
| `realtime` | Supabase Realtime subscription on `bank_mq_messages` table | Inbound + Outbound |
| `webhook` | HTTP POST with HMAC-SHA256 signatures | Outbound delivery |
| `sse` | Server-Sent Events stream (future) | Outbound delivery |

### Inbound Messages (Bank → KOB)
Banks POST events to `/bank-mq-connector` with `action: inbound_message`:
```json
{
  "action": "inbound_message",
  "bank_id": "uuid",
  "channel_name": "transaction-feed",
  "message_type": "transaction.created",
  "correlation_id": "unique-id",
  "payload": {
    "external_tx_id": "TX-001",
    "account_id": "uuid",
    "amount": 50000,
    "currency": "XAF",
    "credit_debit": "Credit"
  }
}
```

### Supported Message Types
| Type | Target Table | Operation |
|---|---|---|
| `account.created/updated/closed` | `bank_sourced_accounts` | Upsert |
| `transaction.created` | `bank_sourced_transactions` | Upsert |
| `balance.updated` | `bank_sourced_balances` | Insert |
| `payment.status.*` | `bank_payments` | Update + event log |

### Edge Function
`bank-mq-connector` — Actions: register_channel, list_channels, update_channel, inbound_message, publish_message, list_messages, channel_stats, sandbox_seed_mq

---

## BankCoreAdapter Interface

Banks implement this interface to connect their core banking system:

```typescript
interface BankCoreAdapter {
  validateAccount(accountRef: string): Promise<{ valid: boolean; name?: string }>;
  postDebit(accountRef: string, amount: number, currency: string): Promise<{ success: boolean; reference?: string }>;
  postCredit(accountRef: string, amount: number, currency: string): Promise<{ success: boolean; reference?: string }>;
  getStatus(externalPaymentId: string): Promise<{ status: 'pending' | 'completed' | 'failed'; reason?: string }>;
}
```

## Security

- **mTLS**: Required for production connectors (HTTPS Push + File)
- **HMAC-SHA256**: Payload signing for webhook message integrity (MQ)
- **Certificate Management**: Upload, rotate, and revoke certificates via API
- **Encryption**: DB credentials stored encrypted in `connection_config_encrypted`
- **Deduplication**: SHA-256 for files, `correlation_id` for messages, watermark for DB polling
