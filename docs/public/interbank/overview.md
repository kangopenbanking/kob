# KOB Interbank Engine — Overview

The KOB Interbank Payments Engine enables real-time interbank payment processing between financial institutions in Cameroon using ISO 20022 message standards.

## Architecture

```
┌─────────────┐    REST API     ┌──────────────────┐    ISO 20022     ┌──────────────┐
│  TPP / Bank  │ ──────────────▶│  KOB Interbank   │ ───────────────▶│  Bank        │
│  (Initiator) │                │  Engine          │                 │  Connector   │
└─────────────┘                └──────────────────┘                 └──────────────┘
                                  │                                    │
                                  ▼                                    ▼
                          ┌──────────────┐                    ┌──────────────┐
                          │  Ledger      │                    │  pacs.002    │
                          │  (holds +    │                    │  (status)    │
                          │   postings)  │                    │  camt.054    │
                          └──────────────┘                    │  (settle)    │
                                                              └──────────────┘
```

## Key Components

| Component | Description |
|---|---|
| `interbank-engine` | Consolidated router: payment lifecycle, ISO mapping, dispatch, sandbox |
| `interbank-connector-inbound` | Receives pacs.002/camt.054 from bank connectors (mTLS enforced) |
| `interbank-dispatch-worker` | Outbox processor: reliable delivery to bank endpoints |
| Admin UI (`/admin/interbank-payments`) | 6-tab dashboard: Payments, Participants, Messages, Connectors, Outbox, Reconciliation |

## Supported Message Types

| Type | Direction | Purpose |
|---|---|---|
| pacs.008 | Outbound | Credit transfer instruction to creditor bank |
| pacs.002 | Inbound | Payment status report (accepted/rejected) |
| camt.054 | Inbound | Credit notification / settlement confirmation |
| pain.001 | Outbound | File-mode payment instruction batch |

## Default Configuration

- **Currency**: XAF (CFA Franc BEAC)
- **Country**: Cameroon (CM)
- **Scheme**: KOB_INTERBANK
- **Security**: OAuth2 + mTLS for connectors + HMAC signatures
