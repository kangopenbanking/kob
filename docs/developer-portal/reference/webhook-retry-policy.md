# Webhook Delivery & Retry Policy

## Delivery Parameters

| Parameter | Value |
|---|---|
| Maximum attempts | 7 |
| Timeout per attempt | 10 seconds |
| Expected response | HTTP 200 within 5 seconds |
| Signature algorithm | HMAC-SHA256 |
| Signature header | `X-KOB-Signature` |
| Dead-letter retention | 30 days |

## Retry Schedule

| Attempt | Delay | Cumulative |
|---|---|---|
| 1 (initial) | Immediate | 0 |
| 2 | 1 minute | ~1 min |
| 3 | 5 minutes | ~6 min |
| 4 | 30 minutes | ~36 min |
| 5 | 2 hours | ~2.5 hours |
| 6 | 8 hours | ~10.5 hours |
| 7 (final) | 24 hours | ~34.5 hours |

After all 7 attempts fail, the event moves to the dead-letter queue.

## Delivery Headers

```
X-KOB-Signature: sha256=a1b2c3d4e5f6...
X-KOB-Timestamp: 1711108800
X-KOB-Event-Type: charge.completed
X-KOB-Event-ID: evt_abc123def456
X-KOB-Delivery-Attempt: 1
```

## Dead-Letter Replay

```bash
POST /v1/webhooks/v2/endpoints/{endpointId}/replay
Authorization: Bearer sk_live_...
{ "event_ids": ["evt_abc123"], "replay_all_failed": false }
```

## Best Practices

- Respond 200 within 5 seconds; defer processing to a queue
- Deduplicate by `X-KOB-Event-ID`
- Verify HMAC signature before processing
- Monitor dead-letter queue accumulation
