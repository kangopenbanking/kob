# Real-Time Payment SLA

KOB exposes per-rail confirmation targets so client wallets can show accurate "your money is on its way" timers and merchants can decide whether to hold or release goods at point of sale.

## How it's surfaced

Every `POST /v1/gateway/charges` response and every webhook for `charge.created` includes:

```json
{
  "next_action": {
    "type": "wait_for_callback",
    "rtp_sla": {
      "expected_completion_seconds": 18,
      "sla_tier": "p50_30s",
      "retry_after_seconds": 3,
      "provider_p50_ms": 18000,
      "provider_p95_ms": 42000
    }
  }
}
```

The same value is echoed in the `X-Confirmation-Eta` response header for callers that prefer header-only signalling.

## Targets per rail

The numbers below are p50 / p95 measured over the trailing 30 production days. They are SLA *targets*, not contractual guarantees; the [status page](https://status.kangopenbanking.com) publishes the live trailing metric.

| Channel | Provider | `sla_tier` | p50 | p95 | Notes |
|---|---|---|---|---|---|
| `mobile_money` | MTN MoMo | `p50_30s` | 18 s | 42 s | Approve-then-confirm USSD push. |
| `mobile_money` | Orange Money | `p50_30s` | 22 s | 51 s | Approve via OM app or USSD push. |
| `mobile_money` | Airtel Money | `p50_30s` | 25 s | 58 s | Strong on TD/CG corridors. |
| `mobile_money` | CamPost | `p95_60s` | 38 s | 90 s | Postal-bureau backed; slower out-of-hours. |
| `mobile_money` | Express Union | `p99_300s` | 90 s | 5 min | Cash-pickup envelope; SLA covers code issuance, not collection. |
| `card` | Stripe | `instant` | 1.2 s | 2.8 s | 3DS adds 5-20 s when challenged. |
| `card` | Flutterwave | `p50_30s` | 12 s | 35 s | Used when Stripe declines geo. |
| `bank_transfer` | Flutterwave VA | `p95_60s` | 25 s | 58 s | Customer-initiated transfer. |
| `paypal` | PayPal | `p95_60s` | 28 s | 65 s | Includes redirect approval. |
| `apple_pay` / `google_pay` | Stripe | `instant` | 1.5 s | 3.2 s | Wallet payment sheet. |

## Tier semantics

| `sla_tier` | Definition |
|---|---|
| `instant` | p50 ≤ 5 s, p95 ≤ 10 s. Safe for in-store goods release. |
| `p50_30s` | p50 ≤ 30 s, p95 ≤ 60 s. Show a progress timer. |
| `p95_60s` | p50 ≤ 60 s, p95 ≤ 120 s. Recommended to email receipt rather than wait. |
| `p99_300s` | p50 ≤ 5 min. Asynchronous flow — issue ticket and notify. |
| `best_effort` | No published target. Use for batch payouts and offline rails. |

## Retry guidance

When the rail does not return a terminal state within `expected_completion_seconds`, poll `GET /v1/gateway/charges/{id}/verify` every `retry_after_seconds`. Stop after `provider_p95_ms / 1000` and surface a "still processing — we'll notify you" message instead of indefinite spinners.

## Cited standards

- ISO 20022 RTP scheme — TIPS SLA framework §4.3
- SWIFT gpi v3.1 §5.2 (End-to-end SLA)
- BIS — *Fast payments: enhancing the speed and availability of cross-border payments* (2024)
- W3C Server-Timing — for the `X-Confirmation-Eta` response header convention
