# Kang Open Banking — Go SDK

Official Go SDK for the **Kang Open Banking (KOB) v1 API**, including the **Phase 3** Merchant Operations namespace (exports, statements, reconciliation, API keys, webhook deliveries).

## Install

```bash
go get github.com/kangopenbanking/sdk-go
```

## Quickstart

```go
package main

import (
    "context"
    "fmt"

    kob "github.com/kangopenbanking/sdk-go"
)

func main() {
    c := kob.New(kob.Config{
        ClientID: "your_client_id",
        APIKey:   "sbx_test_xxx",
        Env:      kob.Sandbox,
    })

    ctx := context.Background()
    job, err := c.Merchant.ExportTransactions(ctx, kob.ExportFilters{
        MerchantID: "mch_uuid",
        From:       "2026-04-01",
        To:         "2026-04-30",
        Format:     "csv",
    })
    if err != nil { panic(err) }
    fmt.Println("export id:", job.ExportID)
}
```

## Phase 3 surface

| Group           | Methods |
|-----------------|---------|
| Exports         | `ExportTransactions`, `ExportSettlements`, `ExportFees`, `ExportGet` |
| Statements      | `StatementDownload(merchantID, month, format)` |
| Reconciliation  | `ReconciliationRun`, `ReconciliationGet` |
| Merchant API keys | `APIKeysList`, `APIKeyCreate`, `APIKeyRevoke`, `APIKeyRotate` |
| Webhooks        | `WebhookEndpoints`, `WebhookDeliveries`, `WebhookReplay` |
| Verification    | `VerifyWebhookSignature(payload, sigHex, secret)` |

## Webhook verification

```go
ok := kob.VerifyWebhookSignature(rawBody, r.Header.Get("X-Webhook-Signature"), os.Getenv("WEBHOOK_SECRET"))
if !ok { http.Error(w, "invalid signature", 401); return }
```

## License

MIT.

## PISP Payment Submission (v4.29.3)

As of OpenAPI v4.29.3, `POST /v1/pisp/payment-submission` requires the full payment instruction.

```go
_, err := c.PISP.SubmitPayment(ctx, kob.PispSubmission{
    PaymentID:       "pmt_01HX...",
    ConsentID:       "cns_01HX...",
    Amount:          "50000",
    Currency:        "XAF",
    DebtorAccount:   "10005-00001-09876543210-45",
    CreditorAccount: "10005-00001-12345678901-23",
}, kob.WithIdempotencyKey(uuid.NewString()))
```

## Changelog

- **v1.6.1** — Aligned to OpenAPI v4.29.3 PISP submission schema.
- **v1.6.0** — OpenAPI v4.28.x baseline.
