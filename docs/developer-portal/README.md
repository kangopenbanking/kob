# Kang Open Banking — Developer Portal

> Build payments, open banking, and financial services on Africa's most complete API platform.

## Quick Links

| Resource | Description |
|---|---|
| [Merchant Quickstart](quickstarts/quickstart-merchant.md) | Accept MoMo, Card & PayPal payments in 10 minutes |
| [Platform Quickstart](quickstarts/quickstart-platform.md) | Integrate AISP/PISP for banks and financial institutions |
| [Developer App Quickstart](quickstarts/quickstart-developer-app.md) | Build TPP applications with OAuth 2.0 |
| [API Reference](reference/api-reference.md) | Full OpenAPI 3.1 specification (80+ endpoints) |
| [Postman Collection](reference/postman.md) | Download & run in Postman |

## Platform Overview

KOB provides three integrated layers:

1. **Payment Gateway** — Charges, payouts, refunds, disputes, settlements, subscriptions, split payments
2. **Open Banking** — AISP (account info), PISP (payment initiation), CBPII (confirmation of funds)
3. **Banking Infrastructure** — Double-entry ledger, loan origination, KYC/KYB, credit scoring

**Default currency:** XAF (Central African CFA Franc)  
**Multi-currency:** Extensible to NGN, USD, EUR, GBP

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Your App                       │
├─────────────────────────────────────────────────┤
│              KOB API (v4.15.0)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ Gateway  │ │  Open    │ │    Banking       ││
│  │ Charges  │ │ Banking  │ │ Infrastructure   ││
│  │ Payouts  │ │ AISP     │ │ Ledger           ││
│  │ Refunds  │ │ PISP     │ │ Loans            ││
│  │ Disputes │ │ CBPII    │ │ KYC/KYB          ││
│  └──────────┘ └──────────┘ └──────────────────┘│
├─────────────────────────────────────────────────┤
│  Flutterwave │ Stripe │ PayPal │ MoMo │ Banks  │
└─────────────────────────────────────────────────┘
```

## SDKs

| Language | Package | Install |
|---|---|---|
| Node.js | `@kangopenbanking/sdk` | `npm install @kangopenbanking/sdk` |
| Python | `kangopenbanking` | `pip install kangopenbanking` |
| PHP/Laravel | `kangopenbanking/sdk` | `composer require kangopenbanking/sdk` |

## Support

- **Developer Portal:** [kangopenbanking.com/developer](https://kangopenbanking.com/developer)
- **Email:** developers@kangopenbanking.com
- **Status Page:** [kangopenbanking.com/developer/status](https://kangopenbanking.com/developer/status)
