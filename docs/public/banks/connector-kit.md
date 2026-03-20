# Bank Connector Kit — Overview

The KOB Bank Connector Kit enables financial institutions to connect to the KOB platform using **three integration modes**. Banks choose the mode that best fits their infrastructure.

## Integration Modes

| Mode | Direction | Description | When to Use |
|---|---|---|---|
| **File (CSV/pain.001)** | Bi-directional | Upload CSV files, download payment instruction files | Bank has no API; legacy core banking |
| **Database Connector** | KOB → Bank DB | KOB polls the bank's read-only database replica on a schedule | Bank has a DB replica or CDC feed available |
| **Message Queue (Real-Time)** | Bi-directional | Events pushed/received via webhook, Kafka, RabbitMQ, Supabase Realtime, or SSE | Bank has API capability and needs real-time sync |
| **HTTPS Push** | Bank → KOB | Bank pushes data to KOB ingestion endpoints | Bank has outbound API capability |
| **API Pull (connector_pull)** | KOB → Bank API | KOB polls the bank's REST API on schedule | Bank has REST API; KOB auto-syncs |

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

## 3. API Pull Connector (connector_pull)

### Workflow
1. Register a bank API endpoint (base URL, auth method, resource paths)
2. KOB polls the bank's REST API on a configured schedule
3. Responses are normalized and upserted into `bank_sourced_*` tables
4. Supports OAuth2 client credentials, API key, Basic auth, and Bearer token

### Authentication Methods
| Method | Description |
|---|---|
| `api_key` | Custom header with API key (default `X-API-Key`) |
| `oauth2_client_credentials` | Automatic token exchange via `token_url` |
| `basic` | HTTP Basic Authentication |
| `bearer_token` | Static Bearer token |
| `mtls` | Mutual TLS (certificate-based) |

### Configuration
```json
{
  "base_url": "https://bank-api.example.com",
  "auth_method": "oauth2_client_credentials",
  "auth_config": {
    "token_url": "https://bank-api.example.com/oauth/token",
    "client_id": "kob-connector",
    "client_secret": "...",
    "scope": "accounts:read transactions:read"
  },
  "paths": {
    "accounts": "/api/v1/accounts",
    "transactions": "/api/v1/transactions",
    "balances": "/api/v1/balances",
    "health": "/api/v1/health"
  }
}
```

### Edge Function
`bank-api-connector` — Actions: register_endpoint, list_endpoints, update_endpoint, test_endpoint, trigger_pull, poll_due, list_pull_runs

---

## 4. Message Queue Connector (Real-Time)

### Channel Types
| Type | Protocol | Description | Direction |
|---|---|---|---|
| `realtime` | Supabase Realtime | Subscription on `bank_mq_messages` table | Inbound + Outbound |
| `webhook` | HTTP POST | HMAC-SHA256 signed payloads | Outbound delivery |
| `kafka` | Confluent REST Proxy v3 | Produce/consume via Kafka REST API | Inbound + Outbound |
| `rabbitmq` | RabbitMQ Management HTTP API | Publish/consume via AMQP-over-HTTP | Inbound + Outbound |
| `sse` | Server-Sent Events | Event stream (future) | Outbound delivery |

### Kafka Integration

KOB integrates with Kafka via the **Confluent REST Proxy v3 API**, which allows HTTP-based message production and consumption without requiring native Kafka client libraries.

#### Configuration
```json
{
  "broker_type": "kafka",
  "broker_config": {
    "rest_proxy_url": "https://your-kafka-proxy:8082",
    "topic": "bank.transactions",
    "consumer_group": "kob-consumer",
    "api_key": "your-confluent-api-key",
    "api_secret": "your-confluent-api-secret"
  }
}
```

#### Supported Operations
| Action | Description |
|---|---|
| `register_channel` | Register a Kafka channel with REST Proxy URL and topic |
| `test_broker` | Produce a test ping message to verify connectivity |
| `publish_message` | Produce a message to the configured Kafka topic |
| `consume_broker` | Poll and consume messages from the topic |

#### Message Format (Kafka REST Proxy v3)
```json
{
  "records": [{
    "key": { "type": "STRING", "data": "message-uuid" },
    "value": { "type": "JSON", "data": "{\"message_type\": \"transaction.created\", ...}" }
  }]
}
```

### RabbitMQ Integration

KOB integrates with RabbitMQ via the **Management HTTP API**, enabling message publishing and consumption over AMQP exchanges and queues.

#### Configuration
```json
{
  "broker_type": "rabbitmq",
  "broker_config": {
    "management_url": "https://your-rabbit:15672",
    "exchange": "kob.payments",
    "routing_key": "kob.payment.instructions",
    "queue": "kob.inbound.transactions",
    "vhost": "/",
    "username": "kob-service",
    "password": "encrypted-password"
  }
}
```

#### Supported Operations
| Action | Description |
|---|---|
| `register_channel` | Register a RabbitMQ channel with management URL, exchange, and routing key |
| `test_broker` | Publish a test message to verify connectivity and routing |
| `publish_message` | Publish a message to the configured exchange with routing key |
| `consume_broker` | Consume messages from the configured queue |

#### Message Properties
- `delivery_mode: 2` — Persistent messages survive broker restarts
- `content_type: application/json` — All payloads are JSON
- `correlation_id` — Unique ID for deduplication and tracing
- Custom headers: `x-kob-message-type`, `x-kob-bank-id`

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

### Broker Actions (New)
| Action | Description |
|---|---|
| `test_broker` | Test Kafka/RabbitMQ connectivity with a ping message |
| `consume_broker` | Poll inbound messages from a broker channel |
| `broker_delivery_log` | View delivery attempt history with latency/success metrics |

### Edge Function
`bank-mq-connector` — Actions: register_channel, list_channels, update_channel, delete_channel, inbound_message, publish_message, list_messages, channel_stats, test_broker, consume_broker, broker_delivery_log, sandbox_seed_mq

---

## Interbank Dispatch Worker

The `interbank-dispatch-worker` uses an outbox pattern to reliably deliver payment instructions to creditor banks. It now supports full broker delivery:

| Delivery Mode | Implementation |
|---|---|
| `https_push` | Direct HTTP POST to bank endpoint |
| `file` | Generates instruction file for bank download |
| `message_queue` | **Kafka** or **RabbitMQ** delivery via broker adapters, with webhook fallback |

The worker automatically looks up the appropriate MQ channel for the target bank and delivers via the configured broker. If no broker channel exists, it falls back to webhook delivery. All broker deliveries are logged in `broker_delivery_log` for audit and monitoring.

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
- **Encryption**: DB credentials stored encrypted in `connection_config_encrypted`; broker credentials in `broker_config_encrypted`
- **Deduplication**: SHA-256 for files, `correlation_id` for messages, watermark for DB polling
- **Broker Auth**: Kafka (API key/secret or Bearer token), RabbitMQ (Basic auth or Bearer token)
- **Delivery Logging**: All broker deliveries tracked in `broker_delivery_log` with latency and success metrics
