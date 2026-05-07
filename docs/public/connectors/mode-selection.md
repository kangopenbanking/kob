# Connector Mode Selection

Pick the integration mode that matches your core banking system. All modes are additive — you can switch later without migration.

## Comparison matrix

| Mode | Best for | Latency | Setup effort | Bidirectional |
|---|---|---|---|---|
| `connector_push` | Modern systems with outbound webhooks | < 1s | Low | Yes |
| `connector_pull` | REST or SOAP APIs you control | 1–5s | Medium | Yes |
| `db_connector` | Legacy systems with direct DB access | 1–10s | Medium | Read-mostly |
| `file_feed` | End-of-day batch (CSV / SFTP) | Hours | Low | No |
| `mq_realtime` | Kafka / RabbitMQ / IBM MQ | < 1s | High | Yes |
| `hybrid` | Multi-system environments | Mixed | High | Yes |

## Decision flow

```text
Can your core push webhooks?     → connector_push
Else, expose REST/SOAP?          → connector_pull
Else, read-only DB available?    → db_connector
Else, CSV at end of day?         → file_feed
Else, message queue?             → mq_realtime
Multiple of the above?           → hybrid
```

## When to choose what

- **Real-time payments**: `connector_push` or `mq_realtime`.
- **Reconciliation only**: `file_feed` is enough.
- **Modernising in stages**: start with `db_connector`, migrate to `connector_push`.

See the operational runbook at [/developer/bank-connector-runbook](/developer/bank-connector-runbook) for deployment, secrets, and observability.
